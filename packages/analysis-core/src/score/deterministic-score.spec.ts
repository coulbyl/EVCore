import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  FEATURE_WEIGHTS,
  calculateDeterministicScore,
} from './deterministic-score';

describe('FEATURE_WEIGHTS', () => {
  it('sums to exactly 1 (form 30 / xg 30 / dom-ext 25 / volatility 15)', () => {
    const sum = FEATURE_WEIGHTS.recentForm
      .plus(FEATURE_WEIGHTS.xg)
      .plus(FEATURE_WEIGHTS.domExtPerf)
      .plus(FEATURE_WEIGHTS.leagueVolat);
    expect(sum.toNumber()).toBe(1);
  });
});

describe('calculateDeterministicScore', () => {
  it('returns the weighted sum of the four features', () => {
    // 0.8×0.30 + 0.6×0.30 + 0.4×0.25 + 0.2×0.15 = 0.24+0.18+0.10+0.03 = 0.55
    const score = calculateDeterministicScore({
      recentForm: 0.8,
      xg: 0.6,
      domExtPerf: 0.4,
      leagueVolat: 0.2,
    });
    expect(score.toNumber()).toBeCloseTo(0.55, 10);
  });

  it('defaults to FEATURE_WEIGHTS and equals 1 when all features are 1', () => {
    const score = calculateDeterministicScore({
      recentForm: 1,
      xg: 1,
      domExtPerf: 1,
      leagueVolat: 1,
    });
    expect(score.toNumber()).toBe(1);
  });

  it('honours overridden weights', () => {
    const score = calculateDeterministicScore(
      { recentForm: 1, xg: 0, domExtPerf: 0, leagueVolat: 0 },
      {
        recentForm: new Decimal('0.5'),
        xg: new Decimal('0.2'),
        domExtPerf: new Decimal('0.2'),
        leagueVolat: new Decimal('0.1'),
      },
    );
    expect(score.toNumber()).toBe(0.5);
  });
});
