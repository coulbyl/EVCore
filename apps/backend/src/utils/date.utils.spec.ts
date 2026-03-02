import { describe, it, expect } from 'vitest';
import {
  parseIsoDate,
  parseUnderstatDatetimeUtc,
  seasonFallbackStartDate,
  seasonFallbackEndDate,
  oneDayWindow,
  currentSeason,
  activeSeasons,
} from './date.utils';

describe('date.utils', () => {
  it('parses valid ISO dates', () => {
    expect(parseIsoDate('2022-08-05T19:00:00+00:00').toISOString()).toBe(
      '2022-08-05T19:00:00.000Z',
    );
  });

  it('parses Understat datetime as UTC', () => {
    expect(parseUnderstatDatetimeUtc('2022-08-06 12:30:00').toISOString()).toBe(
      '2022-08-06T12:30:00.000Z',
    );
  });

  it('returns EPL fallback season bounds', () => {
    expect(seasonFallbackStartDate(2021).toISOString()).toBe(
      '2021-08-01T00:00:00.000Z',
    );
    expect(seasonFallbackEndDate(2021).toISOString()).toBe(
      '2022-05-31T00:00:00.000Z',
    );
  });

  it('builds a one day window around a date', () => {
    const { from, to } = oneDayWindow(new Date('2022-08-10T15:45:00.000Z'));
    expect(from.toISOString()).toBe('2022-08-09T15:45:00.000Z');
    expect(to.toISOString()).toBe('2022-08-11T15:45:00.000Z');
  });

  it('computes current season for August-start competitions', () => {
    expect(currentSeason(7, new Date('2026-03-15T00:00:00.000Z'))).toBe(2025);
    expect(currentSeason(7, new Date('2026-09-01T00:00:00.000Z'))).toBe(2026);
  });

  it('computes current season for January-start competitions', () => {
    expect(currentSeason(0, new Date('2026-03-15T00:00:00.000Z'))).toBe(2026);
    expect(currentSeason(0, new Date('2025-12-31T23:59:59.000Z'))).toBe(2025);
  });

  it('returns active seasons for any competition start month', () => {
    expect(activeSeasons(7, 3, new Date('2026-03-15T00:00:00.000Z'))).toEqual([
      2023, 2024, 2025,
    ]);
    expect(activeSeasons(2, 4, new Date('2026-01-10T00:00:00.000Z'))).toEqual([
      2022, 2023, 2024, 2025,
    ]);
  });

  it('throws on invalid seasonStartMonth', () => {
    expect(() => currentSeason(-1)).toThrow('Invalid seasonStartMonth');
    expect(() => currentSeason(12)).toThrow('Invalid seasonStartMonth');
    expect(() => currentSeason(1.5)).toThrow('Invalid seasonStartMonth');
  });

  it('throws on invalid active season count', () => {
    expect(() => activeSeasons(7, 0)).toThrow('Invalid season count');
    expect(() => activeSeasons(7, -2)).toThrow('Invalid season count');
    expect(() => activeSeasons(7, 2.5)).toThrow('Invalid season count');
  });
});
