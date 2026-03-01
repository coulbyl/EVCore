import { describe, it, expect } from 'vitest';
import { ApiFootballStatisticsResponseSchema } from './stats.schema';

const validTeamStats = (teamId: number) => ({
  team: { id: teamId, name: `Team ${teamId}` },
  statistics: [
    { type: 'Shots on Goal', value: 5 },
    { type: 'Ball Possession', value: '62%' },
    { type: 'Passes %', value: null },
  ],
});

const validResponse = {
  get: 'fixtures/statistics' as const,
  parameters: { fixture: '867946' },
  results: 2,
  response: [validTeamStats(42), validTeamStats(52)],
};

describe('ApiFootballStatisticsResponseSchema', () => {
  it('accepts a valid 2-team statistics response', () => {
    expect(
      ApiFootballStatisticsResponseSchema.safeParse(validResponse).success,
    ).toBe(true);
  });

  it('accepts numeric, string, and null statistic values', () => {
    const result = ApiFootballStatisticsResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const stats = result.data.response[0].statistics;
    expect(stats[0].value).toBe(5);
    expect(stats[1].value).toBe('62%');
    expect(stats[2].value).toBeNull();
  });

  it('accepts an empty statistics array for a team (no stats available)', () => {
    const noStats = {
      ...validResponse,
      response: [
        { team: { id: 42, name: 'Arsenal' }, statistics: [] },
        validTeamStats(52),
      ],
    };
    expect(ApiFootballStatisticsResponseSchema.safeParse(noStats).success).toBe(
      true,
    );
  });

  it('rejects a response with only 1 team (partial API response)', () => {
    const oneTeam = { ...validResponse, response: [validTeamStats(42)] };
    expect(ApiFootballStatisticsResponseSchema.safeParse(oneTeam).success).toBe(
      false,
    );
  });

  it('rejects a response with 3 teams (malformed payload)', () => {
    const threeTeams = {
      ...validResponse,
      response: [validTeamStats(42), validTeamStats(52), validTeamStats(99)],
    };
    expect(
      ApiFootballStatisticsResponseSchema.safeParse(threeTeams).success,
    ).toBe(false);
  });

  it('rejects an empty response array', () => {
    expect(
      ApiFootballStatisticsResponseSchema.safeParse({
        ...validResponse,
        response: [],
      }).success,
    ).toBe(false);
  });

  it('rejects wrong get literal', () => {
    expect(
      ApiFootballStatisticsResponseSchema.safeParse({
        ...validResponse,
        get: 'fixtures',
      }).success,
    ).toBe(false);
  });

  it('rejects team with id = 0 (not positive)', () => {
    const bad = {
      ...validResponse,
      response: [
        { team: { id: 0, name: 'Bad' }, statistics: [] },
        validTeamStats(52),
      ],
    };
    expect(ApiFootballStatisticsResponseSchema.safeParse(bad).success).toBe(
      false,
    );
  });
});
