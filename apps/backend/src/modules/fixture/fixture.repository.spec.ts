import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FixtureRepository } from './fixture.repository';
import type { PrismaService } from '@/prisma.service';

describe('FixtureRepository scheduled fixture queries', () => {
  const prisma = {
    client: {
      fixture: {
        findMany: vi.fn().mockResolvedValue([]),
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
      select: { id: true, externalId: true },
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
      select: { id: true, externalId: true },
      orderBy: { scheduledAt: 'asc' },
    });
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
    transaction.mockImplementation(async (callback: (tx: any) => unknown) =>
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
