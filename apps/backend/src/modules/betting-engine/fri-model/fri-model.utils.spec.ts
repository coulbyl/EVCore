import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import {
  buildFriPoissonModel,
  buildFriSupportedMarkets,
  devigOneXTwoOdds,
  estimateFriGoalTotal,
  estimateFriLambdas,
  eloExpectedScore,
  eloProbabilities,
} from './fri-model.utils';

describe('fri-model.utils', () => {
  it('builds FRI-supported markets for the goal-model phase', () => {
    const supported = buildFriSupportedMarkets();

    expect(supported.has(Market.ONE_X_TWO)).toBe(true);
    expect(supported.has(Market.DOUBLE_CHANCE)).toBe(true);
    expect(supported.has(Market.BTTS)).toBe(true);
    expect(supported.has(Market.OVER_UNDER)).toBe(true);
  });

  it('computes coherent ELO probabilities', () => {
    const probabilities = eloProbabilities(1850, 1700);
    const sum = probabilities.home
      .plus(probabilities.draw)
      .plus(probabilities.away)
      .toNumber();

    expect(sum).toBeCloseTo(1, 8);
    expect(probabilities.home.toNumber()).toBeGreaterThan(
      probabilities.away.toNumber(),
    );
  });

  it('computes home edge from ELO expectancy', () => {
    expect(eloExpectedScore(1800, 1700)).toBeGreaterThan(0.5);
    expect(eloExpectedScore(1700, 1800)).toBeLessThan(0.5);
  });

  it('devigs 1X2 odds into normalized probabilities', () => {
    const probabilities = devigOneXTwoOdds({
      bookmaker: 'Pinnacle',
      snapshotAt: new Date('2026-06-02T00:00:00.000Z'),
      homeOdds: new Decimal('2.10'),
      drawOdds: new Decimal('3.20'),
      awayOdds: new Decimal('3.60'),
      overUnderOdds: {},
      bttsYesOdds: null,
      bttsNoOdds: null,
      htftOdds: {},
      ouHtOdds: {},
      firstHalfWinnerOdds: null,
      doubleChanceOdds: null,
    });

    const sum = probabilities.home
      .plus(probabilities.draw)
      .plus(probabilities.away)
      .toNumber();

    expect(sum).toBeCloseTo(1, 8);
  });

  it('estimates a lower goal total for draw-heavy fixtures', () => {
    const balanced = eloProbabilities(1750, 1750);
    const mismatch = eloProbabilities(1950, 1650);

    expect(estimateFriGoalTotal(balanced)).toBeLessThan(
      estimateFriGoalTotal(mismatch),
    );
  });

  it('estimates positive lambdas from 1X2 probabilities', () => {
    const oneXTwo = eloProbabilities(1900, 1700);
    const lambda = estimateFriLambdas(oneXTwo);

    expect(lambda.home).toBeGreaterThan(lambda.away);
    expect(lambda.home).toBeGreaterThan(0);
    expect(lambda.away).toBeGreaterThan(0);
  });

  it('builds non-zero derived markets from the FRI goal model', () => {
    const oneXTwo = devigOneXTwoOdds({
      bookmaker: 'Pinnacle',
      snapshotAt: new Date('2026-06-02T00:00:00.000Z'),
      homeOdds: new Decimal('2.10'),
      drawOdds: new Decimal('3.20'),
      awayOdds: new Decimal('3.60'),
      overUnderOdds: {},
      bttsYesOdds: null,
      bttsNoOdds: null,
      htftOdds: {},
      ouHtOdds: {},
      firstHalfWinnerOdds: null,
      doubleChanceOdds: null,
    });
    const model = buildFriPoissonModel(oneXTwo);

    expect(model.lambda.home).toBeGreaterThan(0);
    expect(model.lambda.away).toBeGreaterThan(0);
    expect(model.distHome.length).toBeGreaterThan(0);
    expect(model.distAway.length).toBeGreaterThan(0);
    expect(model.probabilities.bttsYes.toNumber()).toBeGreaterThan(0);
    expect(model.probabilities.over25.toNumber()).toBeGreaterThan(0);
    expect(
      model.probabilities.over25.plus(model.probabilities.under25).toNumber(),
    ).toBeCloseTo(1, 6);
  });
});
