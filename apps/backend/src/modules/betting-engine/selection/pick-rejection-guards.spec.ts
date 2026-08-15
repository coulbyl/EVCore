import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  getPickRejectionReason,
  computePoissonMarkets,
  Market,
  type SelectionConfig,
  type ViablePick,
} from '@evcore/analysis-core';

// Targeted regression tests for the 2026-08-13 systemic audit findings —
// each covers a guard that either never fired for a whole class of picks
// (DRAW direction floor, OVER_UNDER_HT htftCalibrated) or fired only for a
// literal pick value instead of a whole family (under_high_lambda).

const PROBABILITIES = computePoissonMarkets(1.4, 1.1);

function makePermissiveConfig(
  overrides: Partial<SelectionConfig> = {},
): SelectionConfig {
  return {
    leagueEvThreshold: new Decimal('0.08'),
    valueMinEdge: undefined,
    svMinProbability: new Decimal('0.68'),
    svMinOdds: new Decimal('1.15'),
    htftCalibrated: true,
    pickDirectionProbabilityThreshold: () => new Decimal('0'),
    pickEvFloor: () => new Decimal('0'),
    pickEvSoftCap: () => new Decimal('99'),
    pickMinSelectionOdds: () => new Decimal('1.01'),
    pickMaxSelectionOdds: () => null,
    ...overrides,
  };
}

function makePick(overrides: Partial<ViablePick>): ViablePick {
  return {
    market: Market.ONE_X_TWO,
    pick: 'HOME',
    probability: new Decimal('0.50'),
    odds: new Decimal('2.00'),
    ev: new Decimal('0.10'),
    qualityScore: new Decimal('0.10'),
    ...overrides,
  };
}

describe('getPickRejectionReason — DRAW direction probability floor', () => {
  // This gate checks the fixture's *computed* probabilities.draw (from
  // PROBABILITIES, ≈0.266 for lambda 1.4/1.1), not pick.probability — mirrors
  // how the pre-existing HOME/AWAY branches read probabilities.home/away.
  // pick.probability is set above EV_MIN_PROBABILITY_THRESHOLD (0.40, the
  // generic cross-market floor checked earlier) so these tests isolate the
  // DRAW-specific directional gate.
  it('rejects a DRAW pick when the fixture draw probability is below the configured directional threshold', () => {
    const pick = makePick({
      market: Market.ONE_X_TWO,
      pick: 'DRAW',
      probability: new Decimal('0.50'),
    });
    const config = makePermissiveConfig({
      pickDirectionProbabilityThreshold: () => new Decimal('0.30'), // > 0.266
    });

    const reason = getPickRejectionReason(
      pick,
      new Set(),
      PROBABILITIES,
      config,
      new Decimal('0.08'),
    );

    expect(reason).toBe('probability_too_low');
  });

  it('does not reject a DRAW pick when the fixture draw probability meets the configured threshold', () => {
    const pick = makePick({
      market: Market.ONE_X_TWO,
      pick: 'DRAW',
      probability: new Decimal('0.50'),
    });
    const config = makePermissiveConfig({
      pickDirectionProbabilityThreshold: () => new Decimal('0.20'), // < 0.266
    });

    const reason = getPickRejectionReason(
      pick,
      new Set(),
      PROBABILITIES,
      config,
      new Decimal('0.08'),
    );

    expect(reason).toBeUndefined();
  });
});

describe('getPickRejectionReason — OVER_UNDER_HT htftCalibrated gate', () => {
  it('suspends OVER_UNDER_HT in a league without HT/FT calibration history', () => {
    const pick = makePick({ market: Market.OVER_UNDER_HT, pick: 'OVER_0_5' });
    const config = makePermissiveConfig({ htftCalibrated: false });

    const reason = getPickRejectionReason(
      pick,
      new Set(),
      PROBABILITIES,
      config,
      new Decimal('0.08'),
    );

    expect(reason).toBe('market_suspended');
  });

  it('does not suspend OVER_UNDER_HT in a calibrated league', () => {
    const pick = makePick({ market: Market.OVER_UNDER_HT, pick: 'OVER_0_5' });
    const config = makePermissiveConfig({ htftCalibrated: true });

    const reason = getPickRejectionReason(
      pick,
      new Set(),
      PROBABILITIES,
      config,
      new Decimal('0.08'),
    );

    expect(reason).toBeUndefined();
  });
});

describe('getPickRejectionReason — under_high_lambda generalized to every UNDER_* line', () => {
  it.each(['UNDER', 'UNDER_1_5', 'UNDER_3_5', 'UNDER_4_5'])(
    'rejects %s at a high lambda total',
    (pickValue) => {
      const pick = makePick({ market: Market.OVER_UNDER, pick: pickValue });
      const config = makePermissiveConfig();

      const reason = getPickRejectionReason(
        pick,
        new Set(),
        PROBABILITIES,
        config,
        new Decimal('0.08'),
        3.74, // Nordsjaelland–Valur lambdaTotal from the 2026-08-13 post-mortem
      );

      expect(reason).toBe('under_high_lambda');
    },
  );

  it('does not reject an OVER_* pick at the same high lambda total', () => {
    const pick = makePick({ market: Market.OVER_UNDER, pick: 'OVER_3_5' });
    const config = makePermissiveConfig();

    const reason = getPickRejectionReason(
      pick,
      new Set(),
      PROBABILITIES,
      config,
      new Decimal('0.08'),
      3.74,
    );

    expect(reason).toBeUndefined();
  });

  it('does not reject UNDER_3_5 below the lambda threshold', () => {
    const pick = makePick({ market: Market.OVER_UNDER, pick: 'UNDER_3_5' });
    const config = makePermissiveConfig();

    const reason = getPickRejectionReason(
      pick,
      new Set(),
      PROBABILITIES,
      config,
      new Decimal('0.08'),
      1.8,
    );

    expect(reason).toBeUndefined();
  });
});
