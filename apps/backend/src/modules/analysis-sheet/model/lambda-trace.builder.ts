// `lambdaTrace` et `dataCoverageDetail` — calculs purs sur ModelRun.features.
//
// Objectif : plus aucun ajustement invisible. La v1 n'exposait qu'un
// `adjustmentDelta` agrégé (jusqu'à +0.25 constaté) qui écrasait en un scalaire
// cinq étapes distinctes. Ce module les sépare et les nomme.
//
// Le moteur ne persiste que le λ FINAL. Le λ de base est donc reconstruit en
// inversant la seule étape qui agit sur λ — la correction H2H
// (h2h.utils.ts::adjustLambdaForH2H), exactement inversible hors saturation.
// Les quatre autres étapes agissent sur les PROBABILITÉS, pas sur λ : elles
// sont listées avec `target: "probabilities"`.

import { H2H_MIN_SAMPLE } from '@evcore/analysis-core';
import Decimal from 'decimal.js';
import { round } from '@utils/decimal.utils';
import {
  ABSENCE_REASONS,
  type DataCoverageComponent,
  type DataCoverageDetail,
  type LambdaTrace,
  type LambdaTraceStep,
} from '../analysis-sheet-v2.types';

/** Valeur neutre du score H2H — voir h2h.utils.ts. */
const H2H_NEUTRAL = 0.5;
/** Plancher/plafond appliqués à λ par adjustLambdaForH2H. */
const LAMBDA_MIN = 0.05;
const LAMBDA_MAX = 5;

const DERIVE_LAMBDAS_FORMULA =
  'leagueAvg = max(0.5, (xgF_home + xgF_away + xgA_home + xgA_away) / 4) ; ' +
  'raw_home = S × (xgF_home × xgA_away / leagueAvg) + (1 − S) × meanLambda ; ' +
  'raw_away = S × (xgF_away × xgA_home / leagueAvg) + (1 − S) × meanLambda ; ' +
  'λ_home = clamp(raw_home × homeAdvFactor × lambdaScale, 0.05, 5) ; ' +
  'λ_away = clamp(raw_away × awayDisadvFactor × lambdaScale, 0.05, 5). ' +
  'S = LAMBDA_SHRINKAGE_FACTOR.';

/** Lecture défensive d'un nombre fini dans un enregistrement JSON. */
function readNumber(source: unknown, key: string): number | null {
  if (!source || typeof source !== 'object') return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(source: unknown, key: string): boolean | null {
  if (!source || typeof source !== 'object') return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : null;
}

/** Paramètres de ligne appliqués à deriveLambdas, injectés par l'appelant. */
export type LambdaConfigSnapshot = {
  meanLambda: number | null;
  homeAdvFactor: number | null;
  awayDisadvFactor: number | null;
  lambdaScale: number | null;
  shrinkageFactor: number | null;
};

/**
 * Reconstruit la chaîne complète λ base → λ final.
 *
 * `gamma` est le H2H_GAMMA effectif du moteur ; il est passé plutôt qu'importé
 * pour que ce module reste pur et testable sans la config applicative.
 */
export function buildLambdaTrace(input: {
  features: unknown;
  config: LambdaConfigSnapshot;
  gamma: number;
}): LambdaTrace {
  const { features, config, gamma } = input;

  const lambdaHome = readNumber(features, 'lambdaHome');
  const lambdaAway = readNumber(features, 'lambdaAway');
  const floorHit = readBoolean(features, 'lambdaFloorHit');
  const h2hApplied = readBoolean(features, 'h2h_correction_applied') ?? false;
  const h2hScore = readNumber(features, 'shadow_h2h');
  const congestionApplied =
    readBoolean(features, 'congestion_correction_applied') ?? false;
  const congestionScore = readNumber(features, 'shadow_congestion');

  const notes: string[] = [];
  const steps: LambdaTraceStep[] = [];

  const final =
    lambdaHome !== null && lambdaAway !== null
      ? {
          home: lambdaHome,
          away: lambdaAway,
          total: round(new Decimal(lambdaHome).plus(lambdaAway)),
        }
      : null;

  // ── Étape 1 : correction H2H — la seule qui déplace λ ─────────────────────
  let base: { home: number; away: number } | null = null;
  let baseDerivation: LambdaTrace['baseDerivation'] = 'unavailable';

  if (final === null) {
    notes.push(
      'λ absent de ModelRun.features : le ModelRun est antérieur à son export.',
    );
  } else if (!h2hApplied || h2hScore === null) {
    base = { home: final.home, away: final.away };
    baseDerivation = 'final_is_base';
  } else {
    const signal = new Decimal(h2hScore).minus(H2H_NEUTRAL);
    const favorFactor = new Decimal(1).plus(signal.times(gamma));
    const underdogFactor = new Decimal(1).minus(signal.times(gamma));

    // Le moteur choisit le favori sur les probabilités 1X2 de base, puis ne
    // l'enregistre pas. On l'infère du Poisson brut (même λ de base, avant le
    // blend empirique). Les deux ne divergent que si le blend inverse l'ordre
    // home/away, ce qui est rare — la note ci-dessous le dit explicitement.
    const raw = (features as Record<string, unknown> | null)?.[
      'rawPoissonProbability'
    ];
    const rawHome = readNumber(raw, 'home');
    const rawAway = readNumber(raw, 'away');
    const favoriteIsHome =
      rawHome !== null && rawAway !== null ? rawHome >= rawAway : null;

    const saturated =
      final.home <= LAMBDA_MIN ||
      final.away <= LAMBDA_MIN ||
      final.home >= LAMBDA_MAX ||
      final.away >= LAMBDA_MAX;

    if (favoriteIsHome === null) {
      notes.push(
        'Favori H2H non inférable (rawPoissonProbability absent) : λ de base non reconstructible.',
      );
    } else if (saturated) {
      notes.push(
        'λ final saturé par clamp(0.05, 5) : l’inversion de la correction H2H ne serait pas fidèle.',
      );
    } else if (favorFactor.isZero() || underdogFactor.isZero()) {
      notes.push('Facteur de correction H2H nul : inversion impossible.');
    } else {
      const homeFactor = favoriteIsHome ? favorFactor : underdogFactor;
      const awayFactor = favoriteIsHome ? underdogFactor : favorFactor;
      base = {
        home: round(new Decimal(final.home).div(homeFactor)),
        away: round(new Decimal(final.away).div(awayFactor)),
      };
      baseDerivation = 'inverted_from_final';
      notes.push(
        'Favori H2H inféré des probabilités Poisson brutes : le moteur ne le persiste pas.',
      );
    }

    steps.push({
      name: 'h2h_lambda_correction',
      target: 'lambda',
      applied: true,
      lambdaDelta:
        base !== null
          ? {
              home: round(new Decimal(final.home).minus(base.home)),
              away: round(new Decimal(final.away).minus(base.away)),
            }
          : null,
      input: h2hScore,
      reason:
        `Score H2H ${h2hScore} (neutre = ${H2H_NEUTRAL}), γ = ${gamma}. ` +
        `λ du favori × ${round(favorFactor)}, λ de l’outsider × ${round(underdogFactor)}. ` +
        `Favori : ${favoriteIsHome === null ? 'inconnu' : favoriteIsHome ? 'domicile' : 'extérieur'}.`,
    });
  }

  if (final !== null && (!h2hApplied || h2hScore === null)) {
    steps.push({
      name: 'h2h_lambda_correction',
      target: 'lambda',
      applied: false,
      lambdaDelta: { home: 0, away: 0 },
      input: h2hScore,
      reason:
        h2hScore === null
          ? `Score H2H indisponible (moins de ${H2H_MIN_SAMPLE} confrontations en base) : λ inchangé.`
          : 'Correction H2H désactivée pour ce ModelRun : λ inchangé.',
    });
  }

  // ── Étapes 2 à 5 : elles agissent sur les probabilités, pas sur λ ─────────
  steps.push({
    name: 'three_way_empirical_blend',
    target: 'probabilities',
    applied: true,
    lambdaDelta: null,
    input: null,
    reason:
      'Mélange des probabilités 1X2 Poisson vers les taux empiriques de victoire ' +
      'domicile/extérieur et de nul des deux équipes (poids par ligue, ' +
      'getLeagueThreeWayEmpiricalBlendWeight). N’affecte que le 1X2.',
  });

  steps.push({
    name: 'over_under_shrinkage',
    target: 'probabilities',
    applied: true,
    lambdaDelta: null,
    input: null,
    reason:
      'Shrinkage des probabilités Over/Under vers le taux de base de la ligue, ' +
      'pour les ligues dont la pente de calibration mesurée est proche de zéro ' +
      '(getOverUnderShrinkageConfig). N’affecte que OVER_UNDER.',
  });

  steps.push({
    name: 'h2h_market_signal_shift',
    target: 'probabilities',
    applied: h2hScore !== null,
    lambdaDelta: null,
    input: h2hScore,
    reason:
      h2hScore !== null
        ? 'Décalage logit par marché à partir des taux H2H (BTTS, Over 2.5, clean sheet, win-to-nil).'
        : 'Signaux H2H par marché indisponibles : aucun décalage appliqué.',
  });

  steps.push({
    name: 'congestion_signal_shift',
    target: 'probabilities',
    applied: congestionApplied && congestionScore !== null,
    lambdaDelta: null,
    input: congestionScore,
    reason:
      congestionApplied && congestionScore !== null
        ? `Décalage logit sur Over 2.5 et BTTS à partir du score de congestion ${congestionScore} (0 = calendrier normal).`
        : 'Correction de congestion inactive pour ce ModelRun.',
  });

  return {
    base,
    inputs: {
      // Les xG bruts par équipe ne sont pas persistés dans features (seul un
      // scalaire de matchup normalisé l'est) : on ne les invente pas.
      homeXgFor: null,
      homeXgAgainst: null,
      awayXgFor: null,
      awayXgAgainst: null,
      meanLambda: config.meanLambda,
      homeAdvFactor: config.homeAdvFactor,
      awayDisadvFactor: config.awayDisadvFactor,
      lambdaScale: config.lambdaScale,
      shrinkageFactor: config.shrinkageFactor,
    },
    formula: DERIVE_LAMBDAS_FORMULA,
    steps,
    final,
    floorHit,
    baseDerivation,
    notes: notes.concat(
      'Les xG par équipe entrant dans deriveLambdas ne sont pas persistés dans ' +
        'ModelRun.features (seul un scalaire de matchup normalisé l’est) : ' +
        'ils sont donc null plutôt qu’estimés.',
    ),
    reason: final === null ? ABSENCE_REASONS.PREDATES_FIELD : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// dataCoverageDetail
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Décompose le ratio `model.dataCoverage` de la v1.
 *
 * Le ratio vaut 2/3 = 0.6666… sur la quasi-totalité des matchs, si bien qu'un
 * filtre `>= 0.67` élimine 100 % de la fiche. `level` (entier 0-3) existe pour
 * que le filtrage soit possible sans piège d'arrondi ; `components` dit
 * laquelle des trois manque et pourquoi.
 *
 * `lineMovement` est absent sur ~99,5 % des ModelRun : le signal exige un
 * snapshot de cotes antérieur à KO−7 jours alors que l'ETL ne collecte qu'à
 * partir de J+3 (audit 2026-09-12 §Bugs 2). Le bloc `market[].lineMovement`
 * de la v2 en donne une version exploitable.
 */
export function buildDataCoverageDetail(features: unknown): DataCoverageDetail {
  const lineMovement = readNumber(features, 'shadow_lineMovement');
  const h2h = readNumber(features, 'shadow_h2h');
  const congestion = readNumber(features, 'shadow_congestion');

  const components: DataCoverageComponent[] = [
    {
      name: 'lineMovement',
      present: lineMovement !== null,
      weight: 1 / 3,
      value: lineMovement,
      reason: lineMovement === null ? ABSENCE_REASONS.SINGLE_SNAPSHOT : null,
    },
    {
      name: 'h2h',
      present: h2h !== null,
      weight: 1 / 3,
      value: h2h,
      reason: h2h === null ? ABSENCE_REASONS.SAMPLE_TOO_SMALL : null,
    },
    {
      name: 'congestion',
      present: congestion !== null,
      weight: 1 / 3,
      value: congestion,
      reason: congestion === null ? ABSENCE_REASONS.NOT_COLLECTED : null,
    },
  ];

  const level = components.filter((c) => c.present).length;

  return {
    ratio: round(new Decimal(level).div(components.length)),
    level,
    maxLevel: components.length,
    components,
  };
}
