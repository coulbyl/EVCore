import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FixtureRepository } from './fixture.repository';
import type { PrismaService } from '@/prisma.service';

describe('FixtureRepository scheduled fixture queries', () => {
  const findMany = vi.fn().mockResolvedValue([]);
  const prisma = {
    client: {
      fixture: {
        findMany,
      },
    },
  } as unknown as PrismaService;

  const repository = new FixtureRepository(prisma);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters inactive competitions out of findScheduledForDate', async () => {
    const date = new Date('2026-03-15T10:00:00.000Z');

    await repository.findScheduledForDate(date);

    expect(prisma.client.fixture.findMany).toHaveBeenCalledWith({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          gte: new Date('2026-03-15T00:00:00.000Z'),
          lte: new Date('2026-03-15T23:59:59.999Z'),
        },
        season: { competition: { isActive: true } },
      },
      select: { id: true, externalId: true, scheduledAt: true },
      orderBy: { scheduledAt: 'asc' },
    });
  });

  it('filters inactive competitions out of findScheduledInRange', async () => {
    await repository.findScheduledInRange(
      new Date('2026-03-15T10:00:00.000Z'),
      new Date('2026-03-17T12:00:00.000Z'),
    );

    expect(prisma.client.fixture.findMany).toHaveBeenCalledWith({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          gte: new Date('2026-03-15T00:00:00.000Z'),
          lte: new Date('2026-03-17T23:59:59.999Z'),
        },
        season: { competition: { isActive: true } },
      },
      select: { id: true, externalId: true, scheduledAt: true },
      orderBy: { scheduledAt: 'asc' },
    });
  });

  it('matches fixtures by team names even when accents differ', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'fixture-id',
        scheduledAt: new Date('2024-03-08T17:30:00.000Z'),
        homeTeam: {
          name: 'Fortuna Dusseldorf',
          shortName: 'Fortuna Dusseldorf',
          logoUrl: null,
        },
        awayTeam: {
          name: 'VfL Osnabruck',
          shortName: 'VfL Osnabruck',
          logoUrl: null,
        },
      },
    ]);

    const fixture = await repository.findByDateAndTeams({
      date: new Date('2024-03-08T12:00:00.000Z'),
      homeTeamName: 'Fortuna Düsseldorf',
      awayTeamName: 'VfL Osnabrück',
      competitionCode: 'D2',
    });

    expect(fixture?.id).toBe('fixture-id');
  });

  it('matches fixtures by shortName when the full team name differs', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'fixture-id',
        scheduledAt: new Date('2024-11-09T20:00:00.000Z'),
        homeTeam: {
          name: 'Waalwijk',
          shortName: 'Waalwijk',
          logoUrl: null,
        },
        awayTeam: {
          name: 'NEC Nijmegen',
          shortName: 'Nijmegen',
          logoUrl: null,
        },
      },
    ]);

    const fixture = await repository.findByDateAndTeams({
      date: new Date('2024-11-09T12:00:00.000Z'),
      homeTeamName: 'RKC Waalwijk',
      awayTeamName: 'Nijmegen',
      competitionCode: 'ERD',
    });

    expect(fixture?.id).toBe('fixture-id');
  });

  it('matches fixtures when one side only differs by a club prefix', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'fixture-id',
        scheduledAt: new Date('2025-03-15T19:00:00.000Z'),
        homeTeam: {
          name: 'Waalwijk',
          shortName: 'Waalwijk',
          logoUrl: null,
        },
        awayTeam: {
          name: 'PSV Eindhoven',
          shortName: 'PSV',
          logoUrl: null,
        },
      },
    ]);

    const fixture = await repository.findByDateAndTeams({
      date: new Date('2025-03-15T12:00:00.000Z'),
      homeTeamName: 'RKC Waalwijk',
      awayTeamName: 'PSV Eindhoven',
      competitionCode: 'ERD',
    });

    expect(fixture?.id).toBe('fixture-id');
  });
});

describe('FixtureRepository.upsertFixture', () => {
  const findUnique = vi.fn();
  const upsert = vi.fn();
  const transaction = vi.fn();

  const prisma = {
    client: {
      fixture: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: transaction,
    },
  } as unknown as PrismaService;

  const repository = new FixtureRepository(prisma);

  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation((callback: (tx: any) => unknown) =>
      callback({
        fixture: {
          findUnique,
          upsert,
        },
      }),
    );
  });

  it('marks a newly finished fixture as affecting rolling-stats', async () => {
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({ id: 'fixture-id' });

    const result = await repository.upsertFixture({
      externalId: 123,
      seasonId: 'season-id',
      homeTeamId: 'home-id',
      awayTeamId: 'away-id',
      matchday: 1,
      round: 'Regular Season - 1',
      scheduledAt: new Date('2024-08-05T19:00:00.000Z'),
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      homeHtScore: 1,
      awayHtScore: 0,
    });

    expect(result).toEqual({
      id: 'fixture-id',
      changed: true,
      affectsRollingStats: true,
    });
  });

  it('does not flag unchanged scheduled fixtures as affecting rolling-stats', async () => {
    findUnique.mockResolvedValue({
      id: 'fixture-id',
      scheduledAt: new Date('2024-08-05T19:00:00.000Z'),
      status: 'SCHEDULED',
      homeScore: null,
      awayScore: null,
      homeHtScore: null,
      awayHtScore: null,
    });
    upsert.mockResolvedValue({ id: 'fixture-id' });

    const result = await repository.upsertFixture({
      externalId: 123,
      seasonId: 'season-id',
      homeTeamId: 'home-id',
      awayTeamId: 'away-id',
      matchday: 1,
      round: 'Regular Season - 1',
      scheduledAt: new Date('2024-08-05T19:00:00.000Z'),
      status: 'SCHEDULED',
      homeScore: null,
      awayScore: null,
      homeHtScore: null,
      awayHtScore: null,
    });

    expect(result).toEqual({
      id: 'fixture-id',
      changed: false,
      affectsRollingStats: false,
    });
  });
});

describe('FixtureRepository.upsertOddsSnapshot — Draw No Bet / Team Total', () => {
  const create = vi.fn().mockResolvedValue({ id: 'snap-id' });
  const prisma = {
    client: {
      oddsSnapshot: {
        create,
      },
    },
  } as unknown as PrismaService;

  const repository = new FixtureRepository(prisma);
  const snapshotAt = new Date('2026-07-18T10:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ id: 'snap-id' });
  });

  it('upserts DRAW_NO_BET rows for both picks when odds are present', async () => {
    await repository.upsertOddsSnapshot({
      fixtureId: 'fixture-id',
      bookmaker: 'Bet365',
      snapshotAt,
      homeOdds: 1.57,
      drawOdds: 4.33,
      awayOdds: 5.25,
      overUnderOdds: {},
      bttsYesOdds: null,
      bttsNoOdds: null,
      htftOdds: {},
      ouHtOdds: {},
      firstHalfWinnerOdds: null,
      doubleChanceOdds: null,
      correctScoreOdds: {},
      drawNoBetOdds: { home: 1.22, away: 4.0 },
      teamTotalHomeOdds: {},
      teamTotalAwayOdds: {},
      cleanSheetHomeOdds: null,
      cleanSheetAwayOdds: null,
      winToNilHomeOdds: null,
      winToNilAwayOdds: null,
      winEitherHalfOdds: null,
    });

    const dnbCalls = create.mock.calls.filter(
      ([arg]) => arg.data.market === 'DRAW_NO_BET',
    );
    expect(dnbCalls).toHaveLength(2);
    expect(dnbCalls.map(([arg]) => [arg.data.pick, arg.data.odds])).toEqual(
      expect.arrayContaining([
        ['HOME', 1.22],
        ['AWAY', 4.0],
      ]),
    );
  });

  it('skips DRAW_NO_BET entirely when the bookmaker has no DNB odds', async () => {
    await repository.upsertOddsSnapshot({
      fixtureId: 'fixture-id',
      bookmaker: 'Bet365',
      snapshotAt,
      homeOdds: 1.57,
      drawOdds: 4.33,
      awayOdds: 5.25,
      overUnderOdds: {},
      bttsYesOdds: null,
      bttsNoOdds: null,
      htftOdds: {},
      ouHtOdds: {},
      firstHalfWinnerOdds: null,
      doubleChanceOdds: null,
      correctScoreOdds: {},
      drawNoBetOdds: null,
      teamTotalHomeOdds: {},
      teamTotalAwayOdds: {},
      cleanSheetHomeOdds: null,
      cleanSheetAwayOdds: null,
      winToNilHomeOdds: null,
      winToNilAwayOdds: null,
      winEitherHalfOdds: null,
    });

    expect(
      create.mock.calls.some(([arg]) => arg.data.market === 'DRAW_NO_BET'),
    ).toBe(false);
  });

  it('upserts sparse TEAM_TOTAL_HOME/TEAM_TOTAL_AWAY rows per priced line', async () => {
    await repository.upsertOddsSnapshot({
      fixtureId: 'fixture-id',
      bookmaker: 'Bet365',
      snapshotAt,
      homeOdds: 1.57,
      drawOdds: 4.33,
      awayOdds: 5.25,
      overUnderOdds: {},
      bttsYesOdds: null,
      bttsNoOdds: null,
      htftOdds: {},
      ouHtOdds: {},
      firstHalfWinnerOdds: null,
      doubleChanceOdds: null,
      correctScoreOdds: {},
      drawNoBetOdds: null,
      teamTotalHomeOdds: { OVER_0_5: 1.11, UNDER_0_5: 6.5 },
      teamTotalAwayOdds: { OVER_1_5: 3.5 },
      cleanSheetHomeOdds: null,
      cleanSheetAwayOdds: null,
      winToNilHomeOdds: null,
      winToNilAwayOdds: null,
      winEitherHalfOdds: null,
    });

    const homeCalls = create.mock.calls.filter(
      ([arg]) => arg.data.market === 'TEAM_TOTAL_HOME',
    );
    const awayCalls = create.mock.calls.filter(
      ([arg]) => arg.data.market === 'TEAM_TOTAL_AWAY',
    );
    expect(homeCalls.map(([arg]) => [arg.data.pick, arg.data.odds])).toEqual(
      expect.arrayContaining([
        ['OVER_0_5', 1.11],
        ['UNDER_0_5', 6.5],
      ]),
    );
    expect(awayCalls.map(([arg]) => [arg.data.pick, arg.data.odds])).toEqual([
      ['OVER_1_5', 3.5],
    ]);
  });
});

describe('FixtureRepository.upsertOddsSnapshot — Clean Sheet / Win to Nil / To Win Either Half', () => {
  const create = vi.fn().mockResolvedValue({ id: 'snap-id' });
  const prisma = {
    client: {
      oddsSnapshot: {
        create,
      },
    },
  } as unknown as PrismaService;

  const repository = new FixtureRepository(prisma);
  const snapshotAt = new Date('2026-07-18T13:00:00.000Z');

  const baseInput = {
    fixtureId: 'fixture-id',
    bookmaker: 'Bet365',
    snapshotAt,
    homeOdds: 1.57,
    drawOdds: 4.33,
    awayOdds: 5.25,
    overUnderOdds: {},
    bttsYesOdds: null,
    bttsNoOdds: null,
    htftOdds: {},
    ouHtOdds: {},
    firstHalfWinnerOdds: null,
    doubleChanceOdds: null,
    correctScoreOdds: {},
    drawNoBetOdds: null,
    teamTotalHomeOdds: {},
    teamTotalAwayOdds: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ id: 'snap-id' });
  });

  it('upserts CLEAN_SHEET_HOME/AWAY rows (Yes/No) when odds are present', async () => {
    await repository.upsertOddsSnapshot({
      ...baseInput,
      cleanSheetHomeOdds: { yes: 2.38, no: 1.53 },
      cleanSheetAwayOdds: { yes: 6.5, no: 1.11 },
      winToNilHomeOdds: null,
      winToNilAwayOdds: null,
      winEitherHalfOdds: null,
    });

    const homeCalls = create.mock.calls.filter(
      ([arg]) => arg.data.market === 'CLEAN_SHEET_HOME',
    );
    const awayCalls = create.mock.calls.filter(
      ([arg]) => arg.data.market === 'CLEAN_SHEET_AWAY',
    );
    expect(homeCalls.map(([arg]) => [arg.data.pick, arg.data.odds])).toEqual(
      expect.arrayContaining([
        ['YES', 2.38],
        ['NO', 1.53],
      ]),
    );
    expect(awayCalls.map(([arg]) => [arg.data.pick, arg.data.odds])).toEqual(
      expect.arrayContaining([
        ['YES', 6.5],
        ['NO', 1.11],
      ]),
    );
  });

  it('upserts WIN_TO_NIL_HOME/AWAY rows (Yes/No) when odds are present', async () => {
    await repository.upsertOddsSnapshot({
      ...baseInput,
      cleanSheetHomeOdds: null,
      cleanSheetAwayOdds: null,
      winToNilHomeOdds: { yes: 1.95, no: 1.75 },
      winToNilAwayOdds: { yes: 9.5, no: 1.05 },
      winEitherHalfOdds: null,
    });

    const homeCalls = create.mock.calls.filter(
      ([arg]) => arg.data.market === 'WIN_TO_NIL_HOME',
    );
    const awayCalls = create.mock.calls.filter(
      ([arg]) => arg.data.market === 'WIN_TO_NIL_AWAY',
    );
    expect(homeCalls.map(([arg]) => [arg.data.pick, arg.data.odds])).toEqual(
      expect.arrayContaining([
        ['YES', 1.95],
        ['NO', 1.75],
      ]),
    );
    expect(awayCalls.map(([arg]) => [arg.data.pick, arg.data.odds])).toEqual(
      expect.arrayContaining([
        ['YES', 9.5],
        ['NO', 1.05],
      ]),
    );
  });

  it('upserts TO_WIN_EITHER_HALF rows (Home/Away) when odds are present', async () => {
    await repository.upsertOddsSnapshot({
      ...baseInput,
      cleanSheetHomeOdds: null,
      cleanSheetAwayOdds: null,
      winToNilHomeOdds: null,
      winToNilAwayOdds: null,
      winEitherHalfOdds: { home: 1.3, away: 3.0 },
    });

    const calls = create.mock.calls.filter(
      ([arg]) => arg.data.market === 'TO_WIN_EITHER_HALF',
    );
    expect(calls.map(([arg]) => [arg.data.pick, arg.data.odds])).toEqual(
      expect.arrayContaining([
        ['HOME', 1.3],
        ['AWAY', 3.0],
      ]),
    );
  });

  it('skips all five markets when their odds are null', async () => {
    await repository.upsertOddsSnapshot({
      ...baseInput,
      cleanSheetHomeOdds: null,
      cleanSheetAwayOdds: null,
      winToNilHomeOdds: null,
      winToNilAwayOdds: null,
      winEitherHalfOdds: null,
    });

    const marketsSeen = new Set(
      create.mock.calls.map(([arg]) => arg.data.market),
    );
    expect(marketsSeen.has('CLEAN_SHEET_HOME')).toBe(false);
    expect(marketsSeen.has('CLEAN_SHEET_AWAY')).toBe(false);
    expect(marketsSeen.has('WIN_TO_NIL_HOME')).toBe(false);
    expect(marketsSeen.has('WIN_TO_NIL_AWAY')).toBe(false);
    expect(marketsSeen.has('TO_WIN_EITHER_HALF')).toBe(false);
  });
});
