import { describe, it, expect } from 'vitest';
import { TeamStatsRawSchema, SeasonStatsSchema } from './stats.schema';

const validStats = {
  teamName: 'Arsenal',
  homeWins: 10,
  homeDraws: 3,
  homeLosses: 6,
  awayWins: 7,
  awayDraws: 4,
  awayLosses: 8,
};

describe('TeamStatsRawSchema', () => {
  it('accepts valid team stats', () => {
    expect(TeamStatsRawSchema.safeParse(validStats).success).toBe(true);
  });

  it('accepts all-zero stats (newly promoted team, early season)', () => {
    const zeros = {
      teamName: 'Luton Town',
      homeWins: 0,
      homeDraws: 0,
      homeLosses: 0,
      awayWins: 0,
      awayDraws: 0,
      awayLosses: 0,
    };
    expect(TeamStatsRawSchema.safeParse(zeros).success).toBe(true);
  });

  it('rejects empty teamName', () => {
    expect(
      TeamStatsRawSchema.safeParse({ ...validStats, teamName: '' }).success,
    ).toBe(false);
  });

  it('rejects negative win/draw/loss values', () => {
    expect(
      TeamStatsRawSchema.safeParse({ ...validStats, homeWins: -1 }).success,
    ).toBe(false);
    expect(
      TeamStatsRawSchema.safeParse({ ...validStats, awayLosses: -3 }).success,
    ).toBe(false);
  });

  it('rejects non-integer values', () => {
    expect(
      TeamStatsRawSchema.safeParse({ ...validStats, homeWins: 10.5 }).success,
    ).toBe(false);
  });

  it('rejects string values where numbers are expected', () => {
    expect(
      TeamStatsRawSchema.safeParse({ ...validStats, homeWins: '10' }).success,
    ).toBe(false);
  });

  it('rejects a missing field', () => {
    const { awayWins: _, ...rest } = validStats;
    expect(TeamStatsRawSchema.safeParse(rest).success).toBe(false);
  });
});

describe('SeasonStatsSchema', () => {
  it('accepts an array of valid team stats', () => {
    const season = [validStats, { ...validStats, teamName: 'Chelsea' }];
    expect(SeasonStatsSchema.safeParse(season).success).toBe(true);
  });

  it('accepts an empty array', () => {
    expect(SeasonStatsSchema.safeParse([]).success).toBe(true);
  });

  it('rejects an array containing one invalid entry', () => {
    const bad = { ...validStats, homeWins: -1 };
    expect(SeasonStatsSchema.safeParse([validStats, bad]).success).toBe(false);
  });
});
