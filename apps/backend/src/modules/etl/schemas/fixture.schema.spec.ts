import { describe, it, expect } from 'vitest';
import {
  ApiFootballTeamSchema,
  ApiFootballFixtureSchema,
  ApiFootballFixturesResponseSchema,
  API_FOOTBALL_STATUSES,
} from './fixture.schema';

// Matches the real EPL 2022 payload confirmed from live API test
const validTeam = {
  id: 52,
  name: 'Crystal Palace',
  logo: 'https://media.api-sports.io/football/teams/52.png',
  winner: false,
};

const validFixture = {
  fixture: {
    id: 867946,
    referee: 'A. Taylor',
    timezone: 'UTC',
    date: '2022-08-05T19:00:00+00:00',
    timestamp: 1659726000,
    periods: { first: 1659726000, second: 1659729600 },
    venue: { id: 525, name: 'Selhurst Park', city: 'London' },
    status: { long: 'Match Finished', short: 'FT', elapsed: 90, extra: null },
  },
  league: {
    id: 39,
    name: 'Premier League',
    country: 'England',
    logo: 'https://media.api-sports.io/football/leagues/39.png',
    flag: 'https://media.api-sports.io/flags/gb-eng.svg',
    season: 2022,
    round: 'Regular Season - 1',
    standings: true,
  },
  teams: {
    home: validTeam,
    away: {
      id: 42,
      name: 'Arsenal',
      logo: 'https://media.api-sports.io/football/teams/42.png',
      winner: true,
    },
  },
  goals: { home: 0, away: 2 },
  score: {
    halftime: { home: 0, away: 1 },
    fulltime: { home: 0, away: 2 },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null },
  },
};

const validResponse = {
  get: 'fixtures' as const,
  parameters: { league: '39', season: '2022' },
  errors: [],
  results: 1,
  paging: { current: 1, total: 1 },
  response: [validFixture],
};

// ─── ApiFootballTeamSchema ────────────────────────────────────────────────────

describe('ApiFootballTeamSchema', () => {
  it('accepts a valid team', () => {
    expect(ApiFootballTeamSchema.safeParse(validTeam).success).toBe(true);
  });

  it('accepts winner: null (draw)', () => {
    expect(
      ApiFootballTeamSchema.safeParse({ ...validTeam, winner: null }).success,
    ).toBe(true);
  });

  it('rejects a non-integer id', () => {
    expect(
      ApiFootballTeamSchema.safeParse({ ...validTeam, id: 52.5 }).success,
    ).toBe(false);
  });

  it('rejects id = 0 (not positive)', () => {
    expect(
      ApiFootballTeamSchema.safeParse({ ...validTeam, id: 0 }).success,
    ).toBe(false);
  });

  it('rejects empty name', () => {
    expect(
      ApiFootballTeamSchema.safeParse({ ...validTeam, name: '' }).success,
    ).toBe(false);
  });
});

// ─── ApiFootballFixtureSchema ─────────────────────────────────────────────────

describe('ApiFootballFixtureSchema', () => {
  it('accepts a valid finished fixture', () => {
    expect(ApiFootballFixtureSchema.safeParse(validFixture).success).toBe(true);
  });

  it('accepts a POSTPONED fixture with null scores', () => {
    const postponed = {
      ...validFixture,
      fixture: {
        ...validFixture.fixture,
        status: {
          long: 'Match Postponed',
          short: 'PST',
          elapsed: null,
          extra: null,
        },
      },
      goals: { home: null, away: null },
      score: {
        halftime: { home: null, away: null },
        fulltime: { home: null, away: null },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null },
      },
    };
    expect(ApiFootballFixtureSchema.safeParse(postponed).success).toBe(true);
  });

  it('accepts a NS (not started) fixture', () => {
    const ns = {
      ...validFixture,
      fixture: {
        ...validFixture.fixture,
        status: {
          long: 'Not Started',
          short: 'NS',
          elapsed: null,
          extra: null,
        },
      },
      goals: { home: null, away: null },
      score: {
        halftime: { home: null, away: null },
        fulltime: { home: null, away: null },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null },
      },
    };
    expect(ApiFootballFixtureSchema.safeParse(ns).success).toBe(true);
  });

  it('accepts AET (after extra time) with penalty nulls', () => {
    const aet = {
      ...validFixture,
      fixture: {
        ...validFixture.fixture,
        status: {
          long: 'Match Finished',
          short: 'AET',
          elapsed: 120,
          extra: null,
        },
      },
      goals: { home: 2, away: 2 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 2 },
        extratime: { home: 0, away: 0 },
        penalty: { home: null, away: null },
      },
    };
    expect(ApiFootballFixtureSchema.safeParse(aet).success).toBe(true);
  });

  it('accepts a 0-0 scoreline', () => {
    const draw = {
      ...validFixture,
      goals: { home: 0, away: 0 },
      score: { ...validFixture.score, fulltime: { home: 0, away: 0 } },
    };
    expect(ApiFootballFixtureSchema.safeParse(draw).success).toBe(true);
  });

  it('accepts fixture without extra field on status (optional)', () => {
    const noExtra = {
      ...validFixture,
      fixture: {
        ...validFixture.fixture,
        status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
      },
    };
    expect(ApiFootballFixtureSchema.safeParse(noExtra).success).toBe(true);
  });

  it('accepts all valid API-FOOTBALL status codes', () => {
    for (const short of API_FOOTBALL_STATUSES) {
      const f = {
        ...validFixture,
        fixture: {
          ...validFixture.fixture,
          status: { long: short, short, elapsed: null, extra: null },
        },
      };
      expect(ApiFootballFixtureSchema.safeParse(f).success).toBe(true);
    }
  });

  it('rejects an unknown status code', () => {
    const bad = {
      ...validFixture,
      fixture: {
        ...validFixture.fixture,
        status: { long: 'Delayed', short: 'DLY', elapsed: null },
      },
    };
    expect(ApiFootballFixtureSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a negative goal count', () => {
    const bad = { ...validFixture, goals: { home: -1, away: 0 } };
    expect(ApiFootballFixtureSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a date without timezone offset', () => {
    const bad = {
      ...validFixture,
      fixture: { ...validFixture.fixture, date: '2022-08-05T19:00:00' },
    };
    expect(ApiFootballFixtureSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects fixture with missing teams.home', () => {
    const { teams: _, ...rest } = validFixture;
    const bad = { ...rest, teams: { away: validFixture.teams.away } };
    expect(ApiFootballFixtureSchema.safeParse(bad).success).toBe(false);
  });
});

// ─── ApiFootballFixturesResponseSchema ───────────────────────────────────────

describe('ApiFootballFixturesResponseSchema', () => {
  it('accepts a valid response with fixtures', () => {
    expect(
      ApiFootballFixturesResponseSchema.safeParse(validResponse).success,
    ).toBe(true);
  });

  it('accepts an empty response array (season not yet started)', () => {
    expect(
      ApiFootballFixturesResponseSchema.safeParse({
        ...validResponse,
        results: 0,
        response: [],
      }).success,
    ).toBe(true);
  });

  it('accepts paging.total = 0 for an empty season response', () => {
    expect(
      ApiFootballFixturesResponseSchema.safeParse({
        ...validResponse,
        results: 0,
        response: [],
        paging: { current: 1, total: 0 },
      }).success,
    ).toBe(true);
  });

  it('rejects wrong get value', () => {
    expect(
      ApiFootballFixturesResponseSchema.safeParse({
        ...validResponse,
        get: 'odds',
      }).success,
    ).toBe(false);
  });

  it('rejects a response where one fixture is invalid', () => {
    const bad = {
      ...validResponse,
      response: [{ ...validFixture, goals: { home: -1, away: 0 } }],
    };
    expect(ApiFootballFixturesResponseSchema.safeParse(bad).success).toBe(
      false,
    );
  });
});
