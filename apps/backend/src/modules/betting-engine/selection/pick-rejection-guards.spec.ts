import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  getPickRejectionReason,
  buildQualityScore,
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

describe('buildQualityScore — longshot penalty generalized beyond 1X2 (2026-08-15)', () => {
  // Backtest (backtest-longshot-penalty-odds-buckets.ts, ~24.5k fixtures,
  // real bookmaker odds) found the same "claimed EV inflates at long odds"
  // pattern on RESULT_TOTAL_GOALS and HALF_TIME_FULL_TIME as on 1X2
  // AWAY/DRAW — dampen those two the same way. RESULT_BTTS/FIRST_HALF_WINNER/
  // OVER_UNDER showed the same direction but too noisy (n<300 at long odds)
  // to set a floor confidently, so they must stay undampened.
  const EV = new Decimal('0.30');
  const DETERMINISTIC_SCORE = new Decimal('0.60');
  const baseline = buildQualityScore(
    EV,
    DETERMINISTIC_SCORE,
    Market.RESULT_TOTAL_GOALS,
    'HOME_OVER_2_5',
    new Decimal('2.00'),
  );

  it('dampens RESULT_TOTAL_GOALS at long odds regardless of which pick', () => {
    const longshot = buildQualityScore(
      EV,
      DETERMINISTIC_SCORE,
      Market.RESULT_TOTAL_GOALS,
      'AWAY_UNDER_1_5',
      new Decimal('20.00'),
    );
    expect(longshot.lessThan(baseline)).toBe(true);
    // Never below the measured floor (0.12), regardless of how long the odds go.
    expect(
      longshot.dividedBy(EV.mul(DETERMINISTIC_SCORE)).toNumber(),
    ).toBeGreaterThanOrEqual(0.12);
  });

  it('does not dampen RESULT_TOTAL_GOALS below its odds threshold', () => {
    const shortOdds = buildQualityScore(
      EV,
      DETERMINISTIC_SCORE,
      Market.RESULT_TOTAL_GOALS,
      'HOME_OVER_2_5',
      new Decimal('3.50'),
    );
    expect(shortOdds.toNumber()).toBeCloseTo(baseline.toNumber(), 12);
  });

  it('dampens HALF_TIME_FULL_TIME at long odds regardless of which pick', () => {
    const normal = buildQualityScore(
      EV,
      DETERMINISTIC_SCORE,
      Market.HALF_TIME_FULL_TIME,
      'HOME_HOME',
      new Decimal('2.00'),
    );
    const longshot = buildQualityScore(
      EV,
      DETERMINISTIC_SCORE,
      Market.HALF_TIME_FULL_TIME,
      'AWAY_DRAW',
      new Decimal('20.00'),
    );
    expect(longshot.lessThan(normal)).toBe(true);
    expect(
      longshot.dividedBy(EV.mul(DETERMINISTIC_SCORE)).toNumber(),
    ).toBeGreaterThanOrEqual(0.15);
  });

  it('leaves RESULT_BTTS, FIRST_HALF_WINNER and OVER_UNDER undampened at long odds (noisy signal, deferred)', () => {
    const noPenaltyMarkets: Array<[Market, string]> = [
      [Market.RESULT_BTTS, 'AWAY_YES'],
      [Market.FIRST_HALF_WINNER, 'AWAY'],
      [Market.OVER_UNDER, 'OVER_4_5'],
    ];
    for (const [market, pick] of noPenaltyMarkets) {
      const longshot = buildQualityScore(
        EV,
        DETERMINISTIC_SCORE,
        market,
        pick,
        new Decimal('20.00'),
      );
      expect(longshot.toNumber()).toBeCloseTo(
        EV.mul(DETERMINISTIC_SCORE).toNumber(),
        12,
      );
    }
  });
});
