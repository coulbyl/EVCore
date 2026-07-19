import { describe, it, expect } from 'vitest';
import { BetStatus, Market } from '@evcore/db';
import {
  resolveSelectionFinalResult,
  resolveSelectionEarlyResult,
  type SettleableSelection,
} from './channel-selection-settlement';

function sel(overrides: Partial<SettleableSelection>): SettleableSelection {
  return {
    market: Market.ONE_X_TWO,
    pick: 'HOME',
    ...overrides,
  };
}

const SCORES_2_1 = {
  homeScore: 2,
  awayScore: 1,
  homeHtScore: 1,
  awayHtScore: 0,
};

describe('resolveSelectionFinalResult', () => {
  it('settles a winning 1X2 HOME pick', () => {
    expect(resolveSelectionFinalResult(sel({ pick: 'HOME' }), SCORES_2_1)).toBe(
      BetStatus.WON,
    );
  });

  it('settles a losing 1X2 AWAY pick', () => {
    expect(resolveSelectionFinalResult(sel({ pick: 'AWAY' }), SCORES_2_1)).toBe(
      BetStatus.LOST,
    );
  });

  it('settles BTTS YES from the final score', () => {
    expect(
      resolveSelectionFinalResult(
        sel({ market: Market.BTTS, pick: 'YES' }),
        SCORES_2_1,
      ),
    ).toBe(BetStatus.WON);
  });

  it('settles a first-half market from HT scores', () => {
    expect(
      resolveSelectionFinalResult(
        sel({ market: Market.FIRST_HALF_WINNER, pick: 'HOME' }),
        SCORES_2_1,
      ),
    ).toBe(BetStatus.WON);
  });
});

describe('resolveSelectionEarlyResult', () => {
  it('confirms BTTS YES once both teams have scored', () => {
    expect(
      resolveSelectionEarlyResult(sel({ market: Market.BTTS, pick: 'YES' }), {
        homeScore: 1,
        awayScore: 1,
        homeHtScore: null,
        awayHtScore: null,
      }),
    ).toBe(BetStatus.WON);
  });

  it('defers an unconfirmed BTTS YES (only one team scored)', () => {
    expect(
      resolveSelectionEarlyResult(sel({ market: Market.BTTS, pick: 'YES' }), {
        homeScore: 1,
        awayScore: 0,
        homeHtScore: null,
        awayHtScore: null,
      }),
    ).toBeNull();
  });

  it('never early-settles a 1X2 pick', () => {
    expect(
      resolveSelectionEarlyResult(sel({ pick: 'HOME' }), SCORES_2_1),
    ).toBeNull();
  });

  it('early-LOSES an UNDER pick once the line is exceeded', () => {
    expect(
      resolveSelectionEarlyResult(
        sel({ market: Market.OVER_UNDER, pick: 'UNDER' }),
        { homeScore: 2, awayScore: 1, homeHtScore: null, awayHtScore: null },
      ),
    ).toBe(BetStatus.LOST);
  });
});
