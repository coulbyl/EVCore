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

  // Regression: UCL/UEL/UECL qualifying rounds start in June (seasonStartMonth
  // < 6), but the competition still spans two calendar years by convention.
  // Without this override, upsertSeason's (competitionId, name) key would
  // split one real season across two rows the moment seasonStartMonth is
  // tuned below 6 to capture those early qualifiers (audit 2026-08-01).
  it('always formats UEFA cup competitions as YYYY-YY, even below the month threshold', () => {
    expect(seasonNameFromYear(2026, 5, 'UCL')).toBe('2026-27');
    expect(seasonNameFromYear(2026, 5, 'UEL')).toBe('2026-27');
    expect(seasonNameFromYear(2026, 5, 'UECL')).toBe('2026-27');
    expect(seasonNameFromYear(2026, 0, 'UCL')).toBe('2026-27');
  });

  it('leaves non-European competitions on the month threshold', () => {
    expect(seasonNameFromYear(2026, 5, 'SVN1')).toBe('2026');
  });
});
