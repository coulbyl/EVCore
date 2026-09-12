import { describe, expect, it } from 'vitest';
import {
  buildLegPool,
  countByCorrelationGroup,
  LEG_POOL_DEFAULTS,
  type LegPoolCandidate,
} from './leg-pool.builder';
import type {
  CalibrationCell,
  TargetMarketEvaluation,
} from '../analysis-sheet-v2.types';

function target(
  overrides: Partial<TargetMarketEvaluation> = {},
): TargetMarketEvaluation {
  return {
    key: 'HOME',
    market: 'ONE_X_TWO',
    pick: 'HOME',
    label: 'V1',
    modelProbability: 0.55,
    rawModelProbability: 0.53,
    adjustmentDelta: 0.02,
    marketProbability: {
      raw: 0.5,
      deVigged: 0.47,
      method: 'proportional',
      overround: 1.06,
      outcomes: ['HOME', 'DRAW', 'AWAY'],
      reason: null,
    },
    edge: 0.05,
    odds: 2,
    ev: 0.1,
    status: 'rejected',
    rejectionReason: 'ev_below_threshold',
    gates: {
      evFloor: 0.08,
      minOdds: 2,
      maxOdds: null,
      minProbability: 0.4,
      segmentDisabled: false,
    },
    reason: null,
    ...overrides,
  };
}

function candidate(
  overrides: Partial<LegPoolCandidate> = {},
): LegPoolCandidate {
  return {
    fixtureId: 'fx-1',
    kickoff: '2026-09-12T18:00:00.000Z',
    match: 'Arsenal - Chelsea',
    competitionCode: 'PL',
    status: 'SCHEDULED',
    coverageRatio: 0.6667,
    coverageLevel: 2,
    flags: {
      avoid: false,
      calibrationAlert: false,
      calibrationAlertOverUnder: false,
    },
    targetMarkets: [target()],
    ...overrides,
  };
}

const CALIBRATION: Map<string, CalibrationCell> = new Map([
  [
    'ONE_X_TWO:PL',
    {
      market: 'ONE_X_TWO',
      competitionCode: 'PL',
      competitionName: 'Premier League',
      n: 420,
      wins: 180,
      losses: 240,
      hitRate: 0.4286,
      avgPredictedProbability: 0.48,
      observedFrequency: 0.4286,
      calibrationRatio: 0.893,
      brierScore: 0.24,
      roi: -0.03,
    },
  ],
]);

describe('buildLegPool', () => {
  it('retient un pick rejeté par le moteur : la fiche expose, elle ne sélectionne pas', () => {
    const pool = buildLegPool({
      candidates: [candidate()],
      filters: LEG_POOL_DEFAULTS,
      calibrationIndex: CALIBRATION,
    });

    expect(pool.entries).toHaveLength(1);
    expect(pool.entries[0]?.key).toBe('HOME');
  });

  it('écarte une cote sous minOdds et compte l’exclusion', () => {
    const pool = buildLegPool({
      candidates: [candidate({ targetMarkets: [target({ odds: 1.2 })] })],
      filters: LEG_POOL_DEFAULTS,
      calibrationIndex: CALIBRATION,
    });

    expect(pool.entries).toHaveLength(0);
    expect(pool.excludedCounts.below_min_odds).toBe(1);
  });

  it('écarte un match drapeauté quand excludeFlags est actif, et le garde sinon', () => {
    const flagged = candidate({
      flags: {
        avoid: true,
        calibrationAlert: false,
        calibrationAlertOverUnder: false,
      },
    });

    const excluded = buildLegPool({
      candidates: [flagged],
      filters: LEG_POOL_DEFAULTS,
      calibrationIndex: CALIBRATION,
    });
    expect(excluded.entries).toHaveLength(0);
    expect(excluded.excludedCounts.flags).toBe(1);

    const kept = buildLegPool({
      candidates: [flagged],
      filters: { ...LEG_POOL_DEFAULTS, excludeFlags: false },
      calibrationIndex: CALIBRATION,
    });
    expect(kept.entries).toHaveLength(1);
    expect(kept.entries[0]?.flags.avoid).toBe(true);
  });

  it('écarte un statut non demandé', () => {
    const pool = buildLegPool({
      candidates: [candidate({ status: 'FINISHED' })],
      filters: LEG_POOL_DEFAULTS,
      calibrationIndex: CALIBRATION,
    });

    expect(pool.entries).toHaveLength(0);
    expect(pool.excludedCounts.status).toBe(1);
  });

  it('écarte une couverture insuffisante', () => {
    const pool = buildLegPool({
      candidates: [candidate({ coverageRatio: 0.3333, coverageLevel: 1 })],
      filters: LEG_POOL_DEFAULTS,
      calibrationIndex: CALIBRATION,
    });

    expect(pool.entries).toHaveLength(0);
    expect(pool.excludedCounts.min_coverage).toBe(1);
  });

  it('laisse passer le niveau 2/3, qui est le maximum atteignable en pratique', () => {
    const pool = buildLegPool({
      candidates: [candidate({ coverageRatio: 0.6667 })],
      filters: LEG_POOL_DEFAULTS,
      calibrationIndex: CALIBRATION,
    });

    expect(pool.entries).toHaveLength(1);
  });

  it('rattache la fiabilité historique du couple marché × compétition', () => {
    const pool = buildLegPool({
      candidates: [candidate()],
      filters: LEG_POOL_DEFAULTS,
      calibrationIndex: CALIBRATION,
    });

    expect(pool.entries[0]?.reliability).toMatchObject({
      n: 420,
      calibrationRatio: 0.893,
      brierScore: 0.24,
    });
  });

  it('motive une fiabilité inconnue plutôt que de la laisser vide', () => {
    const pool = buildLegPool({
      candidates: [candidate({ competitionCode: 'INCONNUE' })],
      filters: LEG_POOL_DEFAULTS,
      calibrationIndex: CALIBRATION,
    });

    expect(pool.entries[0]?.reliability).toMatchObject({
      n: 0,
      calibrationRatio: null,
      reason: 'no_data_in_sample',
    });
  });

  it('étiquette toutes les sélections d’un même match dans le même groupe de corrélation', () => {
    const pool = buildLegPool({
      candidates: [
        candidate({
          targetMarkets: [
            target({ key: 'HOME' }),
            target({ key: 'BTTS_YES', market: 'BTTS', pick: 'YES' }),
          ],
        }),
      ],
      filters: LEG_POOL_DEFAULTS,
      calibrationIndex: CALIBRATION,
    });

    expect(pool.entries).toHaveLength(2);
    expect(new Set(pool.entries.map((e) => e.correlationGroup)).size).toBe(1);
    expect(countByCorrelationGroup(pool)).toEqual({ 'fx-1': 2 });
  });

  it('ordonne chronologiquement, sans classer par EV ni par edge', () => {
    const pool = buildLegPool({
      candidates: [
        candidate({
          fixtureId: 'fx-late',
          kickoff: '2026-09-12T20:00:00.000Z',
          targetMarkets: [target({ ev: 0.9, edge: 0.5 })],
        }),
        candidate({
          fixtureId: 'fx-early',
          kickoff: '2026-09-12T12:00:00.000Z',
          targetMarkets: [target({ ev: 0.01, edge: 0.01 })],
        }),
      ],
      filters: LEG_POOL_DEFAULTS,
      calibrationIndex: CALIBRATION,
    });

    // Le pick au plus fort EV ne remonte pas : l'ordre reste temporel.
    expect(pool.entries.map((e) => e.fixtureId)).toEqual([
      'fx-early',
      'fx-late',
    ]);
  });

  it('restreint aux marchés demandés', () => {
    const pool = buildLegPool({
      candidates: [
        candidate({
          targetMarkets: [
            target({ key: 'HOME' }),
            target({ key: 'BTTS_YES', market: 'BTTS', pick: 'YES' }),
          ],
        }),
      ],
      filters: { ...LEG_POOL_DEFAULTS, markets: ['BTTS_YES'] },
      calibrationIndex: CALIBRATION,
    });

    expect(pool.entries.map((e) => e.key)).toEqual(['BTTS_YES']);
    expect(pool.excludedCounts.market_not_requested).toBe(1);
  });

  it('préfère la probabilité marché dé-marginalisée, et retombe sur la brute', () => {
    const pool = buildLegPool({
      candidates: [
        candidate({
          targetMarkets: [
            target({
              key: 'WIN_EITHER_HALF_HOME',
              market: 'TO_WIN_EITHER_HALF',
              pick: 'HOME',
              marketProbability: {
                raw: 0.66,
                deVigged: null,
                method: null,
                overround: null,
                outcomes: null,
                reason: 'no_complement_priced',
              },
            }),
          ],
        }),
      ],
      filters: LEG_POOL_DEFAULTS,
      calibrationIndex: CALIBRATION,
    });

    expect(pool.entries[0]?.marketProbability).toBe(0.66);
  });

  it('rend les filtres appliqués, pour que le périmètre soit vérifiable', () => {
    const pool = buildLegPool({
      candidates: [],
      filters: { ...LEG_POOL_DEFAULTS, minOdds: 1.4 },
      calibrationIndex: CALIBRATION,
    });

    expect(pool.filters.minOdds).toBe(1.4);
    expect(pool.filters.status).toBe('SCHEDULED');
  });
});
