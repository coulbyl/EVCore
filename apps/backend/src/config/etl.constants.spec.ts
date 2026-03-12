import { describe, it, expect } from 'vitest';
import { estimateApiFootballDailyCalls } from './etl.constants';

describe('estimateApiFootballDailyCalls', () => {
  it('estimates daily API calls for a 10-league setup', () => {
    const plans = Array.from({ length: 10 }, (_, index) => ({
      competition: {
        leagueId: index + 1,
        code: `L${index + 1}`,
        name: `League ${index + 1}`,
        country: 'Test',
        isActive: true,
      },
      seasons: [2023, 2024, 2025],
    }));

    const estimate = estimateApiFootballDailyCalls({
      activeCompetitionPlans: plans,
      avgScheduledFixturesPerLeaguePerDay: 10,
      avgFinishedFixturesWithoutXgPerLeaguePerDay: 2,
    });

    expect(estimate.leagueCount).toBe(10);
    expect(estimate.seasonJobCount).toBe(30);
    expect(estimate.fixturesSyncCalls).toBe(30);
    expect(estimate.resultsSyncCalls).toBe(30);
    expect(estimate.statsSyncCalls).toBe(20);
    expect(estimate.injuriesSyncCalls).toBe(100);
    expect(estimate.oddsLiveSyncCalls).toBe(100);
    expect(estimate.totalCalls).toBe(280);
  });
});
