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
