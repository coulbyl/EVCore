import { describe, it, expect } from 'vitest';
import { seasonNameFromYear } from './season.utils';

describe('seasonNameFromYear', () => {
  it('formats cross-year leagues (seasonStartMonth >= 6) as YYYY-YY', () => {
    expect(seasonNameFromYear(2021, 7)).toBe('2021-22');
    expect(seasonNameFromYear(2023, 7)).toBe('2023-24');
    expect(seasonNameFromYear(2023, 6)).toBe('2023-24');
  });

  it('formats calendar-year leagues (seasonStartMonth < 6) as YYYY', () => {
    expect(seasonNameFromYear(2023, 2)).toBe('2023');
    expect(seasonNameFromYear(2023, 0)).toBe('2023');
  });
});
