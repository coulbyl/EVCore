import { describe, expect, it } from 'vitest';
import {
  ApiFootballFixturesByIdsResponseSchema,
  FixtureByIdDetailsSchema,
  FixtureByIdIdentitySchema,
  FixtureByIdStateSchema,
  FixtureByIdStatisticsSchema,
} from './fixture-full.schema';
import { fixturesByIdsSample } from './fixture-full.sample';

function entry(index = 0) {
  const sample = fixturesByIdsSample();
  const found = sample.response[index];
  if (!found) throw new Error('sample entry missing');
  return found;
}

describe('ApiFootballFixturesByIdsResponseSchema', () => {
  it('accepts a real /fixtures?ids= answer', () => {
    const parsed = ApiFootballFixturesByIdsResponseSchema.safeParse(
      fixturesByIdsSample(),
    );
    expect(parsed.success).toBe(true);
    expect(parsed.data?.response).toHaveLength(3);
  });

  it('rejects another endpoint and a non-array response', () => {
    expect(
      ApiFootballFixturesByIdsResponseSchema.safeParse({
        ...fixturesByIdsSample(),
        get: 'fixtures/statistics',
      }).success,
    ).toBe(false);
    expect(
      ApiFootballFixturesByIdsResponseSchema.safeParse({
        get: 'fixtures',
        results: 0,
        response: {},
      }).success,
    ).toBe(false);
  });
});

describe('FixtureByIdIdentitySchema', () => {
  it('reads the fixture id and both team ids', () => {
    const parsed = FixtureByIdIdentitySchema.parse(entry());
    expect(parsed.fixture.id).toBe(1557450);
    expect(parsed.teams).toEqual({ home: { id: 49 }, away: { id: 33 } });
  });
});

describe('FixtureByIdStatisticsSchema', () => {
  it('accepts the two teams of a real entry', () => {
    expect(
      FixtureByIdStatisticsSchema.safeParse(entry().statistics).success,
    ).toBe(true);
  });

  it('rejects a match without team statistics, as /fixtures/statistics did', () => {
    expect(FixtureByIdStatisticsSchema.safeParse([]).success).toBe(false);
  });
});

describe('FixtureByIdDetailsSchema', () => {
  it('accepts real events, lineups and player statistics', () => {
    for (const index of [0, 1, 2]) {
      expect(FixtureByIdDetailsSchema.safeParse(entry(index)).success).toBe(
        true,
      );
    }
  });

  it('accepts a match without events', () => {
    const match = entry();
    match.events = [];
    expect(FixtureByIdDetailsSchema.safeParse(match).success).toBe(true);
  });

  it('accepts a player without statistics and null counts', () => {
    const match = entry();
    const team = match.players[0];
    if (!team) throw new Error('sample team missing');
    (team.players as unknown[]).push({
      player: { id: 999001, name: 'No Stats', photo: null },
      statistics: [],
    });
    const block = team.players[0]?.statistics[0];
    if (!block) throw new Error('sample block missing');
    Object.assign(block.games, { rating: null, minutes: null });
    Object.assign(block.shots, { total: null, on: null });
    expect(FixtureByIdDetailsSchema.safeParse(match).success).toBe(true);
  });

  it('accepts a cancelled goal without a scorer and a lineup player without an id', () => {
    const match = entry(1);
    const lineup = match.lineups[0];
    if (!lineup) throw new Error('sample lineup missing');
    Object.assign(lineup.startXI[0]?.player ?? {}, { id: null, grid: null });
    expect(FixtureByIdDetailsSchema.safeParse(match).success).toBe(true);
  });

  // Manchester United–Roma, 03/11: the VAR check on the 58' penalty came
  // with `detail: null`, and the whole match lost its events.
  it('accepts a VAR event without a detail', () => {
    const match = entry();
    Object.assign(match.events[0] ?? {}, { type: 'Var', detail: null });
    expect(FixtureByIdDetailsSchema.safeParse(match).success).toBe(true);
  });

  it('leaves out an event without a minute, never the match', () => {
    const match = entry();
    const total = match.events.length;
    Object.assign(match.events[0]?.time ?? {}, { elapsed: null });
    const parsed = FixtureByIdDetailsSchema.parse(match);
    expect(parsed.events).toHaveLength(total - 1);
    expect(parsed.lineups).toHaveLength(match.lineups.length);
    expect(parsed.players).toHaveLength(match.players.length);
    expect(parsed.dropped).toEqual({ events: 1, lineups: 0, players: 0 });
  });

  it('leaves out an invalid lineup or player block alone', () => {
    const match = entry();
    Object.assign(match.lineups[0] ?? {}, { startXI: null });
    Object.assign(match.players[1] ?? {}, { team: { id: null } });
    const parsed = FixtureByIdDetailsSchema.parse(match);
    expect(parsed.lineups).toHaveLength(match.lineups.length - 1);
    expect(parsed.players).toHaveLength(match.players.length - 1);
    expect(parsed.events).toHaveLength(match.events.length);
    expect(parsed.dropped).toEqual({ events: 0, lineups: 1, players: 1 });
  });

  it('counts nothing dropped on a clean match', () => {
    expect(FixtureByIdDetailsSchema.parse(entry()).dropped).toEqual({
      events: 0,
      lineups: 0,
      players: 0,
    });
  });

  it('rejects a match whose players block is missing', () => {
    const match: Record<string, unknown> = entry();
    delete match.players;
    expect(FixtureByIdDetailsSchema.safeParse(match).success).toBe(false);
  });
});

// Minimal entries cut from two real /fixtures?ids= answers of 04/11 (20
// finished matches of 20 championships, 20 not started), names replaced:
// only the fields the API really left null or empty are kept.
const REAL_NOT_STARTED = {
  fixture: {
    id: 1492440,
    referee: 'Referee',
    timezone: 'UTC',
    date: '2026-11-04T22:30:00+00:00',
    timestamp: 1793831400,
    periods: { first: null, second: null },
    venue: { id: null, name: 'Stadium', city: 'City' },
    status: { long: 'Not Started', short: 'NS', elapsed: null, extra: null },
  },
  teams: { home: { id: 1 }, away: { id: 2 } },
  goals: { home: null, away: null },
  score: {
    halftime: { home: null, away: null },
    fulltime: { home: null, away: null },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null },
  },
  events: [],
  lineups: [],
  statistics: [],
  players: [],
};

const REAL_FINISHED = {
  fixture: {
    id: 1552215,
    date: '2026-11-01T15:45:00+00:00',
    status: { long: 'Match Finished', short: 'FT', elapsed: 90, extra: null },
  },
  teams: { home: { id: 202 }, away: { id: 426 } },
  goals: { home: 2, away: 3 },
  score: {
    halftime: { home: 2, away: 2 },
    fulltime: { home: 2, away: 3 },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null },
  },
  // A goal whose scorer has no id.
  events: [
    {
      time: { elapsed: 85, extra: null },
      team: { id: 426, name: 'Away' },
      player: { id: null, name: 'Scorer' },
      assist: { id: null, name: null },
      type: 'Goal',
      detail: 'Normal Goal',
      comments: null,
    },
  ],
  // No formation, a coach without photo, a substitute without id nor grid.
  lineups: [
    {
      team: { id: 426, name: 'Away', colors: null },
      coach: { id: 12353, name: 'Coach', photo: null },
      formation: null,
      startXI: [
        {
          player: { id: 7, name: 'Starter', number: 9, pos: null, grid: null },
        },
      ],
      substitutes: [
        {
          player: { id: null, name: 'Scorer', number: 19, pos: 'F', grid: null },
        },
      ],
    },
  ],
  // A team whose statistics came back empty.
  statistics: [
    { team: { id: 202, name: 'Home' }, statistics: [] },
    {
      team: { id: 426, name: 'Away' },
      statistics: [{ type: 'expected_goals', value: null }],
    },
  ],
  players: [
    {
      team: { id: 426 },
      players: [
        {
          player: { id: null, name: 'Scorer', photo: null },
          statistics: [{ games: { minutes: null, rating: null } }],
        },
        {
          player: { id: 7, name: 'Starter', photo: null },
          statistics: [{ games: { minutes: 90, rating: '7.1' } }],
        },
      ],
    },
  ],
};

describe('/fixtures?ids= against real answers (04/11)', () => {
  it('reads the state of a match not started and of a finished one', () => {
    const notStarted = FixtureByIdStateSchema.parse(REAL_NOT_STARTED);
    expect(notStarted.fixture.status).toEqual({ short: 'NS', elapsed: null });
    expect(notStarted.goals).toEqual({ home: null, away: null });

    const finished = FixtureByIdStateSchema.parse(REAL_FINISHED);
    expect(finished.score?.fulltime).toEqual({ home: 2, away: 3 });
  });

  it('keeps a match not started with its four blocks empty', () => {
    const parsed = FixtureByIdDetailsSchema.parse(REAL_NOT_STARTED);
    expect(parsed.events).toEqual([]);
    expect(parsed.dropped).toEqual({ events: 0, lineups: 0, players: 0 });
  });

  it('drops nothing of the nulls the API really sends', () => {
    const parsed = FixtureByIdDetailsSchema.parse(REAL_FINISHED);
    expect(parsed.dropped).toEqual({ events: 0, lineups: 0, players: 0 });
    expect(parsed.events).toHaveLength(1);
    expect(parsed.lineups[0]?.substitutes).toHaveLength(1);
    // A player without id no longer costs his team its block.
    expect(parsed.players[0]?.players).toHaveLength(2);
    expect(
      FixtureByIdStatisticsSchema.safeParse(REAL_FINISHED.statistics).success,
    ).toBe(true);
  });
});
