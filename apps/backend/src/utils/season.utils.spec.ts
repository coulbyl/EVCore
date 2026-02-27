import { describe, it, expect } from 'vitest';
import { seasonNameFromYear } from './season.utils';

describe('seasonNameFromYear', () => {
  it('formats season names as YYYY-YY', () => {
    expect(seasonNameFromYear(2021)).toBe('2021-22');
    expect(seasonNameFromYear(2023)).toBe('2023-24');
  });
});
