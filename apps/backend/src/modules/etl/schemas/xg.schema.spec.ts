import { describe, it, expect } from 'vitest';
import { XgMatchSchema, UnderstatSeasonSchema } from './xg.schema';

const validMatch = {
  h_id: '1',
  a_id: '2',
  datetime: '2022-08-06 12:30:00',
  h: { title: 'Arsenal' },
  a: { title: 'Leicester' },
  h_xg: '1.23',
  a_xg: '0.87',
};

describe('XgMatchSchema', () => {
  it('accepts a valid xG match', () => {
    const result = XgMatchSchema.safeParse(validMatch);
    expect(result.success).toBe(true);
  });

  it('transforms h_xg and a_xg strings to numbers', () => {
    const result = XgMatchSchema.safeParse(validMatch);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.h_xg).toBe('number');
      expect(typeof result.data.a_xg).toBe('number');
      expect(result.data.h_xg).toBe(1.23);
      expect(result.data.a_xg).toBe(0.87);
    }
  });

  it('accepts xG = 0 (no shots on target)', () => {
    expect(
      XgMatchSchema.safeParse({ ...validMatch, h_xg: '0', a_xg: '0' }).success,
    ).toBe(true);
  });

  it('accepts xG = 0.00 (alternate zero format)', () => {
    expect(
      XgMatchSchema.safeParse({ ...validMatch, h_xg: '0.00', a_xg: '0.00' })
        .success,
    ).toBe(true);
  });

  it('accepts xG at the upper boundary (10.0)', () => {
    expect(
      XgMatchSchema.safeParse({ ...validMatch, h_xg: '10.0', a_xg: '10.0' })
        .success,
    ).toBe(true);
  });

  it('rejects xG > 10 (corrupted data)', () => {
    expect(
      XgMatchSchema.safeParse({ ...validMatch, h_xg: '10.001' }).success,
    ).toBe(false);
    expect(
      XgMatchSchema.safeParse({ ...validMatch, a_xg: '15.2' }).success,
    ).toBe(false);
  });

  it('rejects a negative xG string (regex blocks the minus sign)', () => {
    expect(
      XgMatchSchema.safeParse({ ...validMatch, h_xg: '-0.5' }).success,
    ).toBe(false);
  });

  it('rejects a non-numeric xG string', () => {
    expect(
      XgMatchSchema.safeParse({ ...validMatch, h_xg: 'abc' }).success,
    ).toBe(false);
    expect(
      XgMatchSchema.safeParse({ ...validMatch, a_xg: 'N/A' }).success,
    ).toBe(false);
  });

  it('rejects xG as a number (must be a string from Understat)', () => {
    expect(XgMatchSchema.safeParse({ ...validMatch, h_xg: 1.23 }).success).toBe(
      false,
    );
  });

  it('rejects missing h.title', () => {
    const bad = { ...validMatch, h: {} };
    expect(XgMatchSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects empty h_id', () => {
    expect(XgMatchSchema.safeParse({ ...validMatch, h_id: '' }).success).toBe(
      false,
    );
  });

  it('rejects a datetime shorter than 10 chars', () => {
    expect(
      XgMatchSchema.safeParse({ ...validMatch, datetime: '2022-08-0' }).success,
    ).toBe(false);
  });
});

describe('UnderstatSeasonSchema', () => {
  it('accepts an array of valid matches', () => {
    expect(
      UnderstatSeasonSchema.safeParse([validMatch, validMatch]).success,
    ).toBe(true);
  });

  it('accepts an empty array', () => {
    expect(UnderstatSeasonSchema.safeParse([]).success).toBe(true);
  });

  it('rejects an array containing one invalid match', () => {
    const bad = { ...validMatch, h_xg: '15.0' };
    expect(UnderstatSeasonSchema.safeParse([validMatch, bad]).success).toBe(
      false,
    );
  });
});
