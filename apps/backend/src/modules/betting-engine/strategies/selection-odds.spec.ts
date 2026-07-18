import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
import {
  priceForSelection,
  priceSelection,
  resolveSelectionOdds,
} from './selection-odds';
import type { FullOddsSnapshot } from '../betting-engine.types';

const odds: FullOddsSnapshot = {
  bookmaker: 'test',
  snapshotAt: new Date('2026-06-12T12:00:00.000Z'),
  homeOdds: new Decimal('1.80'),
  drawOdds: new Decimal('3.40'),
  awayOdds: new Decimal('4.20'),
  overUnderOdds: { OVER: new Decimal('1.95'), UNDER: new Decimal('1.85') },
  bttsYesOdds: new Decimal('1.70'),
  bttsNoOdds: new Decimal('2.10'),
  htftOdds: {},
  ouHtOdds: {},
  firstHalfWinnerOdds: null,
  doubleChanceOdds: null,
  drawNoBetOdds: { home: new Decimal('1.22'), away: new Decimal('4.00') },
  teamTotalHomeOdds: { OVER_1_5: new Decimal('1.57') },
  teamTotalAwayOdds: {},
};

describe('resolveSelectionOdds', () => {
  it('resolves 1X2 picks', () => {
    expect(
      resolveSelectionOdds(odds, Market.ONE_X_TWO, 'HOME')?.toNumber(),
    ).toBe(1.8);
    expect(
      resolveSelectionOdds(odds, Market.ONE_X_TWO, 'AWAY')?.toNumber(),
    ).toBe(4.2);
  });

  it('resolves BTTS picks', () => {
    expect(resolveSelectionOdds(odds, Market.BTTS, 'YES')?.toNumber()).toBe(
      1.7,
    );
  });

  it('returns null for a missing price or unknown pick', () => {
    expect(resolveSelectionOdds(odds, Market.DOUBLE_CHANCE, '1X')).toBeNull();
    expect(resolveSelectionOdds(odds, Market.ONE_X_TWO, 'NOPE')).toBeNull();
    expect(resolveSelectionOdds(null, Market.BTTS, 'YES')).toBeNull();
  });

  it('resolves Draw No Bet picks', () => {
    expect(
      resolveSelectionOdds(odds, Market.DRAW_NO_BET, 'HOME')?.toNumber(),
    ).toBe(1.22);
    expect(
      resolveSelectionOdds(odds, Market.DRAW_NO_BET, 'AWAY')?.toNumber(),
    ).toBe(4.0);
  });

  it('resolves Team Total picks per side, null for unpriced lines', () => {
    expect(
      resolveSelectionOdds(
        odds,
        Market.TEAM_TOTAL_HOME,
        'OVER_1_5',
      )?.toNumber(),
    ).toBe(1.57);
    expect(
      resolveSelectionOdds(odds, Market.TEAM_TOTAL_AWAY, 'OVER_1_5'),
    ).toBeNull();
  });
});

describe('priceSelection', () => {
  it('computes odds, implied probability and EV from a price', () => {
    const r = priceSelection({
      probability: new Decimal('0.65'),
      odds: new Decimal('1.70'),
    });
    expect(r.odds?.toNumber()).toBe(1.7);
    expect(r.impliedProbability?.toNumber()).toBeCloseTo(1 / 1.7, 10);
    expect(r.ev?.toNumber()).toBeCloseTo(0.65 * 1.7 - 1, 10);
  });

  it('returns an empty enrichment when no usable price', () => {
    expect(
      priceSelection({ probability: new Decimal('0.6'), odds: null }),
    ).toEqual({});
    expect(
      priceSelection({
        probability: new Decimal('0.6'),
        odds: new Decimal('1'),
      }),
    ).toEqual({});
  });
});

describe('priceForSelection', () => {
  it('prices a DOMINANT-style 1X2 selection end-to-end', () => {
    const r = priceForSelection({
      odds,
      market: Market.ONE_X_TWO,
      pick: 'HOME',
      probability: new Decimal('0.55'),
    });
    expect(r.odds?.toNumber()).toBe(1.8);
    expect(r.ev?.toNumber()).toBeCloseTo(0.55 * 1.8 - 1, 10);
  });

  it('leaves a price-less selection unpriced (analytical only)', () => {
    expect(
      priceForSelection({
        odds: null,
        market: Market.BTTS,
        pick: 'YES',
        probability: new Decimal('0.6'),
      }),
    ).toEqual({});
  });
});
