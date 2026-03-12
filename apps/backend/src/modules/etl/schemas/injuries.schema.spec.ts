import { describe, it, expect } from 'vitest';
import { ApiFootballInjuriesResponseSchema } from './injuries.schema';

const validResponse = {
  get: 'injuries' as const,
  parameters: { fixture: '123456' },
  errors: [],
  results: 2,
  paging: { current: 1, total: 1 },
  response: [
    {
      team: { id: 33, name: 'Manchester United' },
      player: { id: 100, name: 'Player A' },
      fixture: { id: 123456 },
      type: 'Missing Fixture',
      reason: 'Knee Injury',
    },
    {
      team: { id: 40, name: 'Liverpool' },
      player: { id: null, name: 'Player B' },
      fixture: { id: 123456 },
      type: 'Questionable',
      reason: null,
    },
  ],
};

describe('ApiFootballInjuriesResponseSchema', () => {
  it('accepts a valid injuries response', () => {
    expect(
      ApiFootballInjuriesResponseSchema.safeParse(validResponse).success,
    ).toBe(true);
  });

  it('accepts an empty injuries response', () => {
    const empty = {
      ...validResponse,
      results: 0,
      response: [],
    };
    expect(ApiFootballInjuriesResponseSchema.safeParse(empty).success).toBe(
      true,
    );
  });

  it('rejects wrong get literal', () => {
    expect(
      ApiFootballInjuriesResponseSchema.safeParse({
        ...validResponse,
        get: 'fixtures',
      }).success,
    ).toBe(false);
  });

  it('rejects team id <= 0', () => {
    expect(
      ApiFootballInjuriesResponseSchema.safeParse({
        ...validResponse,
        response: [
          {
            ...validResponse.response[0],
            team: { id: 0, name: 'Bad Team' },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
