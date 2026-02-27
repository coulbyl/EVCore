import { describe, it, expect } from 'vitest';
import { ResultSchema } from './result.schema';

const validResult = {
  externalId: 395086,
  homeScore: 1,
  awayScore: 2,
  status: 'FINISHED' as const,
};

describe('ResultSchema', () => {
  it('accepts a valid result', () => {
    expect(ResultSchema.safeParse(validResult).success).toBe(true);
  });

  it('accepts a 0-0 result', () => {
    expect(
      ResultSchema.safeParse({ ...validResult, homeScore: 0, awayScore: 0 })
        .success,
    ).toBe(true);
  });

  it('rejects status other than FINISHED', () => {
    expect(
      ResultSchema.safeParse({ ...validResult, status: 'SCHEDULED' }).success,
    ).toBe(false);
    expect(
      ResultSchema.safeParse({ ...validResult, status: 'POSTPONED' }).success,
    ).toBe(false);
  });

  it('rejects a negative score', () => {
    expect(
      ResultSchema.safeParse({ ...validResult, homeScore: -1 }).success,
    ).toBe(false);
    expect(
      ResultSchema.safeParse({ ...validResult, awayScore: -1 }).success,
    ).toBe(false);
  });

  it('rejects a non-integer score', () => {
    expect(
      ResultSchema.safeParse({ ...validResult, homeScore: 1.5 }).success,
    ).toBe(false);
  });

  it('rejects externalId = 0 (not positive)', () => {
    expect(
      ResultSchema.safeParse({ ...validResult, externalId: 0 }).success,
    ).toBe(false);
  });

  it('rejects missing externalId', () => {
    const { externalId: _, ...rest } = validResult;
    expect(ResultSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects null scores (must be integers, not nullable)', () => {
    expect(
      ResultSchema.safeParse({ ...validResult, homeScore: null }).success,
    ).toBe(false);
  });
});
