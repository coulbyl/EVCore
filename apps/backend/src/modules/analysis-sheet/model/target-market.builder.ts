// Les 7 marchés cibles, TOUJOURS exposés — même rejetés, même non cotés.
//
// C'est le cœur du principe de la v2 : le moteur de pari simple applique des
// gates (plancher d'EV, plancher de cote par ligue, plancher de probabilité)
// calibrés pour une mise sèche, qui écartent structurellement des marchés
// pertinents pour un combiné — mesuré : 0 Over 1.5 viable sur 2 487 évalués,
// 2 436 coupés par le seul plancher d'EV (audit 2026-09-12 §Bugs 7).
//
// Ici ces gates sont du DIAGNOSTIC : on rapporte ce que le moteur a décidé et
// avec quels seuils, sans jamais retirer une ligne de la fiche.

import Decimal from 'decimal.js';
import { pickLabel } from '@utils/pick-labels.utils';
import { round } from '@utils/decimal.utils';
import {
  ABSENCE_REASONS,
  TARGET_MARKETS,
  type ImpliedProbability,
  type MarketQuote,
  type TargetMarketEvaluation,
} from '../analysis-sheet-v2.types';

/** Un pick tel que le moteur l'a évalué (ModelRun.features.evaluatedPicks). */
export type EvaluatedPickInput = {
  market: string;
  pick: string;
  probability: number;
  odds: number;
  ev: number;
  status: 'viable' | 'rejected';
  rejectionReason: string | null;
};

/** Seuils effectifs pour un (compétition, marché, pick), injectés par l'appelant. */
export type PickGates = {
  evFloor: number | null;
  minOdds: number | null;
  maxOdds: number | null;
  minProbability: number | null;
};

/**
 * Au-delà de ce plancher d'EV, le segment est désactivé et non simplement
 * exigeant : `EV_HARD_CAP = 0.90` rejette tout pick dont l'EV dépasse 0.90
 * (`ev_above_hard_cap`) AVANT que le plancher ne soit évalué. Un plancher
 * supérieur est donc mathématiquement infranchissable.
 */
export const EV_FLOOR_DISABLED_ABOVE = 0.9;

/** Un plancher d'EV au-dessus du plafond dur coupe le segment, il ne le filtre pas. */
export function isSegmentDisabled(gates: PickGates): boolean {
  return gates.evFloor !== null && gates.evFloor > EV_FLOOR_DISABLED_ABOVE;
}

/** Résout les seuils d'un (marché, pick) — implémenté côté application. */
export type GateResolver = (market: string, pick: string) => PickGates;

const ABSENT_IMPLIED: ImpliedProbability = {
  raw: null,
  deVigged: null,
  method: null,
  overround: null,
  outcomes: null,
  reason: ABSENCE_REASONS.NO_ODDS,
};

/**
 * Construit les 7 évaluations.
 *
 * Trois sources se recoupent :
 *   1. `evaluatedPicks` — la probabilité du modèle et le verdict du moteur ;
 *   2. `rawProbability` — la probabilité Poisson avant ajustements ;
 *   3. `quotes` — les cotes et la probabilité implicite du marché.
 *
 * Quand (1) manque (marché non coté au moment de l'analyse, donc jamais
 * évalué), le statut est `not_evaluated` et les champs du modèle valent `null`
 * avec un motif : on n'invente aucune probabilité.
 */
export function buildTargetMarketEvaluations(input: {
  evaluatedPicks: readonly EvaluatedPickInput[];
  quotes: readonly MarketQuote[];
  rawProbabilityFor: (market: string, pick: string) => number | null;
  gatesFor: GateResolver;
}): TargetMarketEvaluation[] {
  const { evaluatedPicks, quotes, rawProbabilityFor, gatesFor } = input;

  const quoteByKey = new Map(quotes.map((q) => [q.key, q]));

  return TARGET_MARKETS.map(({ key, market, pick }): TargetMarketEvaluation => {
    const evaluated = evaluatedPicks.find(
      (p) => p.market === market && p.pick === pick,
    );
    const quote = quoteByKey.get(key);
    const implied = quote?.implied ?? ABSENT_IMPLIED;
    const rawProbability = rawProbabilityFor(market, pick);
    const gates = gatesFor(market, pick);

    const modelProbability = evaluated?.probability ?? null;

    // La cote du moteur est celle retenue au moment de l'analyse ; celle du
    // bloc `market` est la meilleure au dernier snapshot. On expose celle du
    // moteur quand elle existe, pour que `ev` et `status` restent cohérents
    // entre eux — sinon la meilleure cote observée.
    const odds = evaluated?.odds ?? quote?.bestOdds ?? null;

    return {
      key: key,
      market,
      pick,
      label: pickLabel({ market, pick }),
      modelProbability,
      rawModelProbability: rawProbability,
      adjustmentDelta:
        modelProbability !== null && rawProbability !== null
          ? round(new Decimal(modelProbability).minus(rawProbability))
          : null,
      marketProbability: implied,
      edge:
        modelProbability !== null && implied.raw !== null
          ? round(new Decimal(modelProbability).minus(implied.raw))
          : null,
      odds,
      ev: evaluated?.ev ?? null,
      status: evaluated?.status ?? 'not_evaluated',
      rejectionReason: evaluated?.rejectionReason ?? null,
      gates: { ...gates, segmentDisabled: isSegmentDisabled(gates) },
      // Un marché coté aujourd'hui mais absent d'evaluatedPicks ne l'était pas
      // à l'instant de l'analyse : dans les deux cas, le moteur n'avait pas de
      // prix pour le juger.
      reason: evaluated !== undefined ? null : ABSENCE_REASONS.NO_ODDS,
    };
  });
}
