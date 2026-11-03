import { describe, expect, it } from 'vitest';
import {
  ApiFootballSquadsResponseSchema,
  squadPlayersOf,
} from './squads.schema';

// Rows of the real answers of 03/11 (/players/squads?team=50 and 173).
const ANSWER = {
  get: 'players/squads',
  parameters: { team: '50' },
  errors: [],
  results: 1,
  paging: { current: 1, total: 1 },
  response: [
    {
      team: {
        id: 50,
        name: 'Manchester City',
        logo: 'https://media.api-sports.io/football/teams/50.png',
      },
      players: [
        {
          id: 1100,
          name: 'E. Haaland',
          age: 25,
          number: 9,
          position: 'Attacker',
          photo: 'https://media.api-sports.io/football/players/1100.png',
        },
        {
          id: 307123,
          name: 'N. O&apos;Reilly',
          age: 20,
          number: 33,
          position: 'Defender',
          photo: 'https://media.api-sports.io/football/players/307123.png',
        },
        {
          id: 398192,
          name: 'A. MaksimoviÄ\u0087',
          age: 18,
          number: null,
          position: 'Midfielder',
          photo: null,
        },
        {
          id: 0,
          name: 'Unknown',
          age: null,
          number: null,
          position: null,
          photo: null,
        },
        {
          id: 1100,
          name: 'E. Haaland',
          age: 25,
          number: 9,
          position: 'Attacker',
          photo: null,
        },
      ],
    },
  ],
};

describe('squads schema', () => {
  it('accepts a real answer and cleans its players', () => {
    const parsed = ApiFootballSquadsResponseSchema.parse(ANSWER);
    expect(squadPlayersOf(parsed, 50)).toEqual([
      {
        playerExternalId: 1100,
        name: 'E. Haaland',
        number: 9,
        position: 'Attacker',
        photoUrl: 'https://media.api-sports.io/football/players/1100.png',
      },
      {
        playerExternalId: 307123,
        name: "N. O'Reilly",
        number: 33,
        position: 'Defender',
        photoUrl: 'https://media.api-sports.io/football/players/307123.png',
      },
      {
        playerExternalId: 398192,
        name: 'A. Maksimović',
        number: null,
        position: 'Midfielder',
        photoUrl: null,
      },
    ]);
  });

  it('an answer about another team gives nothing', () => {
    const parsed = ApiFootballSquadsResponseSchema.parse(ANSWER);
    expect(squadPlayersOf(parsed, 33)).toEqual([]);
  });

  it('an empty answer is valid and empty', () => {
    const parsed = ApiFootballSquadsResponseSchema.parse({ response: [] });
    expect(squadPlayersOf(parsed, 50)).toEqual([]);
  });

  it('rejects a player without an id and a negative id', () => {
    const broken = (player: unknown) => ({
      response: [{ team: { id: 50 }, players: [player] }],
    });
    expect(
      ApiFootballSquadsResponseSchema.safeParse(broken({ name: 'X' })).success,
    ).toBe(false);
    expect(
      ApiFootballSquadsResponseSchema.safeParse(broken({ id: -1, name: 'X' }))
        .success,
    ).toBe(false);
  });
});
