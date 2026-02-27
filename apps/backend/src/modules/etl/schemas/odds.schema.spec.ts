import { describe, expect, it } from 'vitest';
import { OddsApiResponseSchema } from './odds.schema';

describe('OddsApiResponseSchema', () => {
  it('parses a valid match-winner payload', () => {
    const parsed = OddsApiResponseSchema.parse({
      response: [
        {
          fixture: { id: 1234, date: '2023-01-01T15:00:00Z' },
          update: 1_672_584_000,
          bookmakers: [
            {
              name: 'Bookie',
              bets: [
                {
                  name: 'Match Winner',
                  values: [
                    { value: 'Home', odd: '2.10' },
                    { value: 'Draw', odd: '3.40' },
                    { value: 'Away', odd: '4.20' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(parsed.response[0].bookmakers[0].bets[0].values[0].odd).toBe(2.1);
  });

  it('rejects unsupported pick labels', () => {
    const result = OddsApiResponseSchema.safeParse({
      response: [
        {
          fixture: { id: 1234 },
          bookmakers: [
            {
              name: 'Bookie',
              bets: [
                {
                  name: 'Match Winner',
                  values: [{ value: '1', odd: '2.10' }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid decimal odds', () => {
    const result = OddsApiResponseSchema.safeParse({
      response: [
        {
          fixture: { id: 1234 },
          bookmakers: [
            {
              name: 'Bookie',
              bets: [
                {
                  name: 'Match Winner',
                  values: [{ value: 'Home', odd: 'abc' }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects odds <= 1', () => {
    const result = OddsApiResponseSchema.safeParse({
      response: [
        {
          fixture: { id: 1234 },
          bookmakers: [
            {
              name: 'Bookie',
              bets: [
                {
                  name: 'Match Winner',
                  values: [{ value: 'Home', odd: '1.00' }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects non-match-winner markets in this worker schema', () => {
    const result = OddsApiResponseSchema.safeParse({
      response: [
        {
          fixture: { id: 1234 },
          bookmakers: [
            {
              name: 'Bookie',
              bets: [{ name: 'Over/Under', values: [] }],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
