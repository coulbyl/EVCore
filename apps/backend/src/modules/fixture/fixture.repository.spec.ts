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
