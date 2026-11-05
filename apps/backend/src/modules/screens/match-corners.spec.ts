import { describe, expect, it } from 'vitest';
import { cornersOf, isCornersMarket } from './match-corners';

describe('cornersOf', () => {
  it('shows nothing before or during the match', () => {
    for (const status of ['SCHEDULED', 'IN_PROGRESS', 'POSTPONED']) {
      expect(cornersOf({ status, homeCorners: 3, awayCorners: 1 })).toBe(null);
    }
  });

  it('says « not counted yet » between the whistle and the statistics', () => {
    expect(
      cornersOf({ status: 'FINISHED', homeCorners: 7, awayCorners: null }),
    ).toEqual({ state: 'pending' });
  });

  it('gives the count once both teams are in, zero included', () => {
    expect(
      cornersOf({ status: 'FINISHED', homeCorners: 7, awayCorners: 0 }),
    ).toEqual({ state: 'counted', home: 7, away: 0 });
  });
});

describe('isCornersMarket', () => {
  it('reads full-match corner markets only', () => {
    expect(isCornersMarket('CORNERS')).toBe(true);
    expect(isCornersMarket('CORNERS_HT')).toBe(false);
    expect(isCornersMarket('OVER_UNDER')).toBe(false);
  });
});
