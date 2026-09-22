import { describe, expect, it } from 'vitest';
import {
  normalizeStatisticType,
  normalizeTeamStatistics,
  parseStatisticValue,
} from './fixture-statistics.mapper';

describe('fixture statistics mapper', () => {
  it('normalizes the API-Football names consumed by rolling features', () => {
    expect(normalizeStatisticType('Shots on Goal')).toBe('shots_on_goal');
    expect(normalizeStatisticType('Shots insidebox')).toBe('shots_inside_box');
    expect(normalizeStatisticType('Ball Possession')).toBe('ball_possession');
  });

  it('parses numbers and percentages while rejecting missing values', () => {
    expect(parseStatisticValue(7)).toBe(7);
    expect(parseStatisticValue('63%')).toBe(63);
    expect(parseStatisticValue(null)).toBeNull();
    expect(parseStatisticValue('unknown')).toBeNull();
  });

  it('keeps one final value per normalized type', () => {
    expect(
      normalizeTeamStatistics({
        teamId: 'team-1',
        statistics: [
          { type: 'Shots on Goal', value: 4 },
          { type: 'Shots on Goal', value: '5' },
          { type: 'Red Cards', value: null },
        ],
      }),
    ).toEqual([
      {
        teamId: 'team-1',
        type: 'shots_on_goal',
        value: 5,
        rawValue: '5',
      },
    ]);
  });
});
