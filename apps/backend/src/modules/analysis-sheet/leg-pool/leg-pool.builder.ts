// `legPool` — liste à plat des sélections éligibles.
//
// ⚠ Ce module FILTRE, il ne SÉLECTIONNE pas. Aucun classement, aucun score
// maison, aucune composition de combiné : les filtres sont déclaratifs, leurs
// valeurs sont rendues dans la sortie, et l'ordre est purement chronologique.
// Le choix des jambes se fait en aval, à la main.
//
// `correlationGroup` vaut le `fixtureId` : deux sélections qui le partagent
// portent sur le même match et sont donc corrélées. La fiche se contente de
// les étiqueter — elle n'en écarte aucune d'office.

import Decimal from 'decimal.js';
import { round } from '@utils/decimal.utils';
import {
  ABSENCE_REASONS,
  TARGET_MARKETS,
  type CalibrationCell,
  type LegPool,
  type LegPoolEntry,
  type LegPoolFilters,
  type TargetMarketEvaluation,
} from '../analysis-sheet-v2.types';

/**
 * Valeurs par défaut demandées au cahier des charges. `minOdds` à 1.25 exclut
 * les cotes trop courtes pour peser dans un combiné ; `minCoverage` à 0.66
 * correspond au niveau 2/3, qui est le maximum atteignable en pratique
 * (`lineMovement` est absent sur ~99,5 % des matchs — audit §Bugs 2).
 */
export const LEG_POOL_DEFAULTS: LegPoolFilters = {
  minOdds: 1.25,
  markets: TARGET_MARKETS.map((m) => m.key),
  minCoverage: 0.66,
  excludeFlags: true,
  status: 'SCHEDULED',
};

/** Un match, réduit à ce dont le legPool a besoin. */
export type LegPoolCandidate = {
  fixtureId: string;
  kickoff: string;
  match: string;
  competitionCode: string;
  status: string;
  coverageRatio: number;
  coverageLevel: number;
  flags: {
    avoid: boolean;
    calibrationAlert: boolean;
    calibrationAlertOverUnder: boolean;
  };
  targetMarkets: readonly TargetMarketEvaluation[];
};

/** Motifs d'exclusion — comptés et rendus, pour que le filtrage soit auditable. */
const EXCLUSION_KEYS = {
  STATUS: 'status',
  COVERAGE: 'min_coverage',
  FLAGS: 'flags',
  MARKET_NOT_REQUESTED: 'market_not_requested',
  NO_ODDS: 'no_odds',
  BELOW_MIN_ODDS: 'below_min_odds',
} as const;

export function buildLegPool(input: {
  candidates: readonly LegPoolCandidate[];
  filters: LegPoolFilters;
  calibrationIndex: Map<string, CalibrationCell>;
}): LegPool {
  const { candidates, filters, calibrationIndex } = input;

  const excludedCounts: Record<string, number> = {};
  const bump = (key: string, by = 1): void => {
    excludedCounts[key] = (excludedCounts[key] ?? 0) + by;
  };

  const requested = new Set(filters.markets);
  const entries: LegPoolEntry[] = [];

  for (const candidate of candidates) {
    if (candidate.status !== filters.status) {
      bump(EXCLUSION_KEYS.STATUS, candidate.targetMarkets.length);
      continue;
    }
    if (candidate.coverageRatio < filters.minCoverage) {
      bump(EXCLUSION_KEYS.COVERAGE, candidate.targetMarkets.length);
      continue;
    }
    const flagged =
      candidate.flags.avoid ||
      candidate.flags.calibrationAlert ||
      candidate.flags.calibrationAlertOverUnder;
    if (filters.excludeFlags && flagged) {
      bump(EXCLUSION_KEYS.FLAGS, candidate.targetMarkets.length);
      continue;
    }

    for (const target of candidate.targetMarkets) {
      if (!requested.has(target.key)) {
        bump(EXCLUSION_KEYS.MARKET_NOT_REQUESTED);
        continue;
      }
      if (target.odds === null) {
        bump(EXCLUSION_KEYS.NO_ODDS);
        continue;
      }
      if (target.odds < filters.minOdds) {
        bump(EXCLUSION_KEYS.BELOW_MIN_ODDS);
        continue;
      }

      const cell = calibrationIndex.get(
        `${target.market}:${candidate.competitionCode}`,
      );

      entries.push({
        fixtureId: candidate.fixtureId,
        kickoff: candidate.kickoff,
        match: candidate.match,
        competitionCode: candidate.competitionCode,
        key: target.key,
        market: target.market,
        pick: target.pick,
        label: target.label,
        modelProbability: target.modelProbability,
        // Probabilité marché dé-marginalisée quand elle est estimable, sinon
        // la brute — `marketProbability` du bloc `market` porte le détail et
        // la méthode, ici on ne garde que la valeur la plus juste disponible.
        marketProbability:
          target.marketProbability.deVigged ?? target.marketProbability.raw,
        odds: target.odds,
        ev: target.ev,
        edge: target.edge,
        correlationGroup: candidate.fixtureId,
        reliability: cell
          ? {
              n: cell.n,
              calibrationRatio: cell.calibrationRatio,
              brierScore: cell.brierScore,
              hitRate: cell.hitRate,
              reason: null,
            }
          : {
              n: 0,
              calibrationRatio: null,
              brierScore: null,
              hitRate: null,
              reason: ABSENCE_REASONS.NO_DATA_IN_SAMPLE,
            },
        coverageLevel: candidate.coverageLevel,
        flags: candidate.flags,
      });
    }
  }

  return {
    filters,
    // Ordre chronologique uniquement. Trier sur l'EV ou l'edge reviendrait à
    // classer — or l'edge annoncé est anti-prédictif sur nos données, et la
    // fiche n'a pas à suggérer un ordre de préférence.
    entries: entries.sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    excludedCounts,
  };
}

/** Nombre de sélections par match — utile pour repérer les groupes corrélés. */
export function countByCorrelationGroup(pool: LegPool): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of pool.entries) {
    counts[entry.correlationGroup] = (counts[entry.correlationGroup] ?? 0) + 1;
  }
  return counts;
}

/** EV = (probabilité × cote) − 1, exposée telle que définie par le moteur. */
export function computeEv(
  probability: number | null,
  odds: number | null,
): number | null {
  if (probability === null || odds === null) return null;
  return round(new Decimal(probability).times(odds).minus(1));
}
