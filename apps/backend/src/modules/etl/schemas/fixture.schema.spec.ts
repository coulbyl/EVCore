import { describe, it, expect } from 'vitest';
import {
  FootballDataTeamSchema,
  FootballDataFixtureSchema,
  FootballDataResponseSchema,
} from './fixture.schema';

const validTeam = { id: 57, name: 'Arsenal FC', shortName: 'Arsenal' };

const validFixture = {
  id: 395086,
  utcDate: '2022-08-05T19:00:00+00:00',
  matchday: 1,
  status: 'FINISHED' as const,
  homeTeam: validTeam,
  awayTeam: { id: 65, name: 'Manchester City FC', shortName: 'Man City' },
  score: { fullTime: { home: 0, away: 2 } },
};

const validResponse = {
  competition: { code: 'PL' },
  season: {
    startDate: '2022-08-05T00:00:00+00:00',
    endDate: '2023-05-28T00:00:00+00:00',
  },
  matches: [validFixture],
};

// ─── FootballDataTeamSchema ───────────────────────────────────────────────────

describe('FootballDataTeamSchema', () => {
  it('accepts a valid team', () => {
    expect(FootballDataTeamSchema.safeParse(validTeam).success).toBe(true);
  });

  it('rejects a non-integer id', () => {
    expect(
      FootballDataTeamSchema.safeParse({ ...validTeam, id: 57.5 }).success,
    ).toBe(false);
  });

  it('rejects id = 0 (not positive)', () => {
    expect(
      FootballDataTeamSchema.safeParse({ ...validTeam, id: 0 }).success,
    ).toBe(false);
  });

  it('rejects empty name', () => {
    expect(
      FootballDataTeamSchema.safeParse({ ...validTeam, name: '' }).success,
    ).toBe(false);
  });

  it('rejects missing shortName', () => {
    const { shortName: _, ...rest } = validTeam;
    expect(FootballDataTeamSchema.safeParse(rest).success).toBe(false);
  });
});

// ─── FootballDataFixtureSchema ────────────────────────────────────────────────

describe('FootballDataFixtureSchema', () => {
  it('accepts a valid finished fixture', () => {
    expect(FootballDataFixtureSchema.safeParse(validFixture).success).toBe(
      true,
    );
  });

  it('accepts a POSTPONED fixture', () => {
    const postponed = {
      ...validFixture,
      status: 'POSTPONED',
      score: { fullTime: { home: null, away: null } },
    };
    expect(FootballDataFixtureSchema.safeParse(postponed).success).toBe(true);
  });

  it('accepts a 0-0 scoreline', () => {
    const draw = { ...validFixture, score: { fullTime: { home: 0, away: 0 } } };
    expect(FootballDataFixtureSchema.safeParse(draw).success).toBe(true);
  });

  it('accepts null scores for unplayed fixtures', () => {
    const unplayed = {
      ...validFixture,
      status: 'SCHEDULED',
      score: { fullTime: { home: null, away: null } },
    };
    expect(FootballDataFixtureSchema.safeParse(unplayed).success).toBe(true);
  });

  it('accepts all valid statuses', () => {
    const statuses = [
      'SCHEDULED',
      'FINISHED',
      'POSTPONED',
      'CANCELLED',
      'IN_PLAY',
      'PAUSED',
      'SUSPENDED',
      'AWARDED',
    ];
    for (const status of statuses) {
      expect(
        FootballDataFixtureSchema.safeParse({ ...validFixture, status })
          .success,
      ).toBe(true);
    }
  });

  it('rejects an unknown status', () => {
    expect(
      FootballDataFixtureSchema.safeParse({
        ...validFixture,
        status: 'DELAYED',
      }).success,
    ).toBe(false);
  });

  it('rejects a negative score', () => {
    const bad = { ...validFixture, score: { fullTime: { home: -1, away: 0 } } };
    expect(FootballDataFixtureSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects matchday = 0', () => {
    expect(
      FootballDataFixtureSchema.safeParse({ ...validFixture, matchday: 0 })
        .success,
    ).toBe(false);
  });

  it('rejects a utcDate without timezone offset', () => {
    // datetime({ offset: true }) requires a timezone
    const bad = { ...validFixture, utcDate: '2022-08-05T19:00:00' };
    expect(FootballDataFixtureSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects missing homeTeam', () => {
    const { homeTeam: _, ...rest } = validFixture;
    expect(FootballDataFixtureSchema.safeParse(rest).success).toBe(false);
  });
});

// ─── FootballDataResponseSchema ───────────────────────────────────────────────

describe('FootballDataResponseSchema', () => {
  it('accepts a valid response with matches', () => {
    expect(FootballDataResponseSchema.safeParse(validResponse).success).toBe(
      true,
    );
  });

  it('accepts a response with an empty matches array', () => {
    expect(
      FootballDataResponseSchema.safeParse({ ...validResponse, matches: [] })
        .success,
    ).toBe(true);
  });

  it('accepts null season dates (some seasons return null)', () => {
    const noDate = {
      ...validResponse,
      season: { startDate: null, endDate: null },
    };
    expect(FootballDataResponseSchema.safeParse(noDate).success).toBe(true);
  });

  it('rejects empty competition code', () => {
    const bad = { ...validResponse, competition: { code: '' } };
    expect(FootballDataResponseSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a response where one match is invalid', () => {
    const bad = {
      ...validResponse,
      matches: [{ ...validFixture, matchday: 0 }],
    };
    expect(FootballDataResponseSchema.safeParse(bad).success).toBe(false);
  });
});
