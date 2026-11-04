import { describe, expect, it } from 'vitest';
import {
  computeMarketGrid,
  computePoissonMarkets,
  Market,
  type MarketGridResult,
} from '@evcore/analysis-core';
import Decimal from 'decimal.js';
import { resolveProbabilitySource } from './probability-source';

const AT = new Date('2026-10-20T18:00:00.000Z');
const SNAPSHOT = new Date('2026-10-20T15:00:00.000Z');

function pinnacleRows() {
  const base = {
    bookmaker: 'Pinnacle',
    snapshotAt: SNAPSHOT,
    homeOdds: null,
    drawOdds: null,
    awayOdds: null,
  };
  return [
    {
      ...base,
      market: Market.ONE_X_TWO,
      pick: null,
      odds: null,
      homeOdds: new Decimal('2.10'),
      drawOdds: new Decimal('3.40'),
      awayOdds: new Decimal('3.70'),
    },
    { ...base, market: Market.OVER_UNDER, pick: 'OVER', odds: '2.02' },
    { ...base, market: Market.OVER_UNDER, pick: 'UNDER', odds: '1.88' },
  ];
}

const stats = {
  lambda: { home: 1.6, away: 1.0 },
  probabilities: computePoissonMarkets(1.6, 1.0),
  rawProbabilities: computePoissonMarkets(1.5, 1.0),
  appliedCorrections: {
    h2hLambda: true,
    h2hMarketSignals: true,
    congestion: true,
  },
};

describe('resolveProbabilitySource', () => {
  it('keeps the statistics engine and its corrections without a grid', () => {
    const marketGrid: MarketGridResult = computeMarketGrid([], AT);
    expect(resolveProbabilitySource({ marketGrid, stats })).toEqual({
      source: 'POISSON_MAIN',
      ...stats,
    });
  });

  it('takes λ, probabilities and raw Poisson from the grid, with no correction', () => {
    const marketGrid = computeMarketGrid(pinnacleRows(), AT);
    if (marketGrid.status !== 'ok') throw new Error('grid expected');
    const resolved = resolveProbabilitySource({ marketGrid, stats });

    expect(resolved.source).toBe('MARKET_GRID');
    expect(resolved.lambda).toEqual({
      home: marketGrid.fit.lambdaHome,
      away: marketGrid.fit.lambdaAway,
    });
    expect(resolved.probabilities).toBe(marketGrid.probabilities);
    expect(resolved.rawProbabilities.home.toNumber()).toBeCloseTo(
      computePoissonMarkets(
        marketGrid.fit.lambdaHome,
        marketGrid.fit.lambdaAway,
      ).home.toNumber(),
      12,
    );
    expect(resolved.appliedCorrections).toEqual({
      h2hLambda: false,
      h2hMarketSignals: false,
      congestion: false,
    });
  });
});
