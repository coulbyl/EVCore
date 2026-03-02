import { describe, expect, it } from 'vitest';
import { ApiFootballOddsResponseSchema } from './odds.schema';

// Minimal valid fixture entry matching the real API-Football /odds response format
function buildOddsResponse(overrides: Record<string, unknown> = {}) {
  return {
    response: [
      {
        fixture: { id: 1379250 },
        update: '2026-03-01T16:30:20+00:00',
        bookmakers: [
          {
            id: 4,
            name: 'Pinnacle',
            bets: [
              {
                id: 1,
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
        ...overrides,
      },
    ],
  };
}

describe('ApiFootballOddsResponseSchema', () => {
  it('parses a valid single-bookmaker Match Winner payload', () => {
    const parsed = ApiFootballOddsResponseSchema.parse(buildOddsResponse());

    const bk = parsed.response[0]?.bookmakers[0];
    const bet = bk?.bets[0];
    expect(bk?.id).toBe(4);
    expect(bk?.name).toBe('Pinnacle');
    expect(bet?.values[0]?.odd).toBe(2.1);
  });

  it('parses a response with multiple bet types per bookmaker (real API format)', () => {
    const multibet = buildOddsResponse();
    (multibet.response[0] as Record<string, unknown>).bookmakers = [
      {
        id: 4,
        name: 'Pinnacle',
        bets: [
          {
            id: 1,
            name: 'Match Winner',
            values: [
              { value: 'Home', odd: '2.10' },
              { value: 'Draw', odd: '3.40' },
              { value: 'Away', odd: '4.20' },
            ],
          },
          {
            id: 5,
            name: 'Goals Over/Under',
            values: [
              { value: 'Over 2.5', odd: '1.57' },
              { value: 'Under 2.5', odd: '2.35' },
            ],
          },
          {
            id: 4,
            name: 'Asian Handicap',
            values: [
              { value: 'Home -0.5', odd: '2.30' },
              { value: 'Away -0.5', odd: '1.62' },
            ],
          },
        ],
      },
    ];

    const parsed = ApiFootballOddsResponseSchema.parse(multibet);
    expect(parsed.response[0]?.bookmakers[0]?.bets).toHaveLength(3);
  });

  it('parses a response with multiple bookmakers (Pinnacle + Bet365)', () => {
    const multi = buildOddsResponse();
    (multi.response[0] as Record<string, unknown>).bookmakers = [
      {
        id: 4,
        name: 'Pinnacle',
        bets: [
          {
            id: 1,
            name: 'Match Winner',
            values: [
              { value: 'Home', odd: '2.08' },
              { value: 'Draw', odd: '3.38' },
              { value: 'Away', odd: '4.15' },
            ],
          },
        ],
      },
      {
        id: 8,
        name: 'Bet365',
        bets: [
          {
            id: 1,
            name: 'Match Winner',
            values: [
              { value: 'Home', odd: '2.10' },
              { value: 'Draw', odd: '3.40' },
              { value: 'Away', odd: '4.20' },
            ],
          },
        ],
      },
    ];

    const parsed = ApiFootballOddsResponseSchema.parse(multi);
    expect(parsed.response[0]?.bookmakers).toHaveLength(2);
    expect(parsed.response[0]?.bookmakers[1]?.id).toBe(8);
  });

  it('transforms odd strings to numbers', () => {
    const parsed = ApiFootballOddsResponseSchema.parse(buildOddsResponse());
    const odds = parsed.response[0]?.bookmakers[0]?.bets[0]?.values;
    expect(typeof odds?.[0]?.odd).toBe('number');
    expect(odds?.[0]?.odd).toBe(2.1);
    expect(odds?.[1]?.odd).toBe(3.4);
  });

  it('rejects invalid decimal odds (non-numeric string)', () => {
    const result = ApiFootballOddsResponseSchema.safeParse(
      buildOddsResponse({
        bookmakers: [
          {
            id: 4,
            name: 'Pinnacle',
            bets: [
              {
                id: 1,
                name: 'Match Winner',
                values: [{ value: 'Home', odd: 'abc' }],
              },
            ],
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects odds <= 1', () => {
    const result = ApiFootballOddsResponseSchema.safeParse(
      buildOddsResponse({
        bookmakers: [
          {
            id: 4,
            name: 'Pinnacle',
            bets: [
              {
                id: 1,
                name: 'Match Winner',
                values: [{ value: 'Home', odd: '1.00' }],
              },
            ],
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects update as a number (must be ISO string)', () => {
    const result = ApiFootballOddsResponseSchema.safeParse(
      buildOddsResponse({ update: 1_672_584_000 }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects missing bookmaker id', () => {
    const result = ApiFootballOddsResponseSchema.safeParse(
      buildOddsResponse({
        bookmakers: [
          {
            name: 'Pinnacle',
            bets: [
              {
                id: 1,
                name: 'Match Winner',
                values: [{ value: 'Home', odd: '2.10' }],
              },
            ],
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
  });

  it('accepts an empty response array', () => {
    const parsed = ApiFootballOddsResponseSchema.parse({ response: [] });
    expect(parsed.response).toHaveLength(0);
  });
});
