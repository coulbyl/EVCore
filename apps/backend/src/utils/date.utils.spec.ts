import { describe, it, expect } from 'vitest';
import {
  parseIsoDate,
  parseUnderstatDatetimeUtc,
  eplSeasonFallbackStartDate,
  eplSeasonFallbackEndDate,
  oneDayWindow,
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
    expect(eplSeasonFallbackStartDate(2021).toISOString()).toBe(
      '2021-08-01T00:00:00.000Z',
    );
    expect(eplSeasonFallbackEndDate(2021).toISOString()).toBe(
      '2022-05-31T00:00:00.000Z',
    );
  });

  it('builds a one day window around a date', () => {
    const { from, to } = oneDayWindow(new Date('2022-08-10T15:45:00.000Z'));
    expect(from.toISOString()).toBe('2022-08-09T15:45:00.000Z');
    expect(to.toISOString()).toBe('2022-08-11T15:45:00.000Z');
  });
});
