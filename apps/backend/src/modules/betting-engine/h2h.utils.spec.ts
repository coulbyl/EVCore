import { describe, it, expect } from 'vitest';
import { adjustLambdaForH2H } from './h2h.utils';

describe('adjustLambdaForH2H', () => {
  it('leaves lambdas unchanged when h2h score is neutral (0.5)', () => {
    const result = adjustLambdaForH2H({
      lambda: { home: 1.5, away: 1.0 },
      favoriteIsHome: true,
      h2hScore: 0.5,
      gamma: 0.2,
    });

    expect(result.home).toBeCloseTo(1.5, 8);
    expect(result.away).toBeCloseTo(1.0, 8);
  });

  it('boosts the home lambda and shrinks the away lambda when the home team is favorite and dominates H2H', () => {
    const result = adjustLambdaForH2H({
      lambda: { home: 1.5, away: 1.0 },
      favoriteIsHome: true,
      h2hScore: 1.0,
      gamma: 0.2,
    });

    // signal = 0.5, favorFactor = 1.1, underdogFactor = 0.9
    expect(result.home).toBeCloseTo(1.5 * 1.1, 8);
    expect(result.away).toBeCloseTo(1.0 * 0.9, 8);
  });

  it('boosts the away lambda when the away team is favorite and dominates H2H', () => {
    const result = adjustLambdaForH2H({
      lambda: { home: 1.0, away: 1.5 },
      favoriteIsHome: false,
      h2hScore: 1.0,
      gamma: 0.2,
    });

    expect(result.away).toBeCloseTo(1.5 * 1.1, 8);
    expect(result.home).toBeCloseTo(1.0 * 0.9, 8);
  });

  it('shrinks the favorite lambda when H2H favors the underdog (h2h < 0.5)', () => {
    const result = adjustLambdaForH2H({
      lambda: { home: 1.5, away: 1.0 },
      favoriteIsHome: true,
      h2hScore: 0.0,
      gamma: 0.2,
    });

    // signal = -0.5, favorFactor = 0.9, underdogFactor = 1.1
    expect(result.home).toBeCloseTo(1.5 * 0.9, 8);
    expect(result.away).toBeCloseTo(1.0 * 1.1, 8);
  });

  it('clamps the result to the [0.05, 5] lambda floor/ceiling', () => {
    const low = adjustLambdaForH2H({
      lambda: { home: 0.06, away: 1.0 },
      favoriteIsHome: true,
      h2hScore: 0.0,
      gamma: 1.0,
    });
    expect(low.home).toBeGreaterThanOrEqual(0.05);

    const high = adjustLambdaForH2H({
      lambda: { home: 4.9, away: 1.0 },
      favoriteIsHome: true,
      h2hScore: 1.0,
      gamma: 1.0,
    });
    expect(high.home).toBeLessThanOrEqual(5);
  });
});
