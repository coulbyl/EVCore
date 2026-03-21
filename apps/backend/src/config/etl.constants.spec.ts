import { describe, it, expect } from 'vitest';
import { estimateApiFootballDailyCalls } from './etl.constants';

describe('estimateApiFootballDailyCalls', () => {
  it('estimates daily API calls for a 10-league setup', () => {
    const estimate = estimateApiFootballDailyCalls({
      leagueCount: 10,
      seasonJobCount: 30,
      avgScheduledFixturesPerLeaguePerDay: 10,
      avgFinishedFixturesWithoutXgPerLeaguePerDay: 2,
    });

    expect(estimate.leagueCount).toBe(10);
    expect(estimate.seasonJobCount).toBe(30);
    expect(estimate.fixturesSyncCalls).toBe(30);
    expect(estimate.settlementSyncCalls).toBe(5);
    expect(estimate.statsSyncCalls).toBe(20);
    expect(estimate.injuriesSyncCalls).toBe(100);
    expect(estimate.oddsLiveSyncCalls).toBe(100);
    expect(estimate.totalCalls).toBe(255);
  });
});
