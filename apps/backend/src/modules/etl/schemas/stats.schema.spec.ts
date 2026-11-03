import { describe, it, expect } from 'vitest';
import { FixtureByIdStatisticsSchema } from './fixture-full.schema';

// The `statistics` block of a /fixtures?ids= entry: the rules
// /fixtures/statistics had (exactly two teams, values number/string/null).
const validTeamStats = (teamId: number) => ({
  team: { id: teamId, name: `Team ${teamId}` },
  statistics: [
    { type: 'Shots on Goal', value: 5 },
    { type: 'Ball Possession', value: '62%' },
    { type: 'Passes %', value: null },
  ],
});

describe('FixtureByIdStatisticsSchema', () => {
  it('accepts two teams', () => {
    expect(
      FixtureByIdStatisticsSchema.safeParse([
        validTeamStats(42),
        validTeamStats(52),
      ]).success,
    ).toBe(true);
  });

  it('accepts numeric, string, and null statistic values', () => {
    const result = FixtureByIdStatisticsSchema.safeParse([
      validTeamStats(42),
      validTeamStats(52),
    ]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const stats = result.data[0]?.statistics ?? [];
    expect(stats[0]?.value).toBe(5);
    expect(stats[1]?.value).toBe('62%');
    expect(stats[2]?.value).toBeNull();
  });

  it('accepts an empty statistics array for a team', () => {
    expect(
      FixtureByIdStatisticsSchema.safeParse([
        { team: { id: 42, name: 'Arsenal' }, statistics: [] },
        validTeamStats(52),
      ]).success,
    ).toBe(true);
  });

  it('rejects one team, three teams and none', () => {
    for (const teams of [
      [validTeamStats(42)],
      [validTeamStats(42), validTeamStats(52), validTeamStats(99)],
      [],
    ]) {
      expect(FixtureByIdStatisticsSchema.safeParse(teams).success).toBe(false);
    }
  });

  it('rejects team with id = 0 (not positive)', () => {
    expect(
      FixtureByIdStatisticsSchema.safeParse([
        { team: { id: 0, name: 'Bad' }, statistics: [] },
        validTeamStats(52),
      ]).success,
    ).toBe(false);
  });
});
