import { describe, it, expect, vi } from 'vitest';
import { CongestionService } from './congestion.service';
import type { PrismaService } from '@/prisma.service';

describe('CongestionService', () => {
  it('returns low congestion when teams are well rested and no dense schedule', async () => {
    const fixtureFindFirst = vi
      .fn()
      .mockResolvedValueOnce({
        scheduledAt: new Date('2026-02-20T12:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        scheduledAt: new Date('2026-02-21T12:00:00.000Z'),
      });
    const fixtureCount = vi.fn().mockResolvedValue(0);

    const prismaMock = {
      client: {
        fixture: {
          findFirst: fixtureFindFirst,
          count: fixtureCount,
        },
      },
    } as unknown as PrismaService;
    const service = new CongestionService(prismaMock);

    await expect(
      service.computeCongestionScore({
        homeTeamId: 'home',
        awayTeamId: 'away',
        fixtureDate: new Date('2026-03-03T12:00:00.000Z'),
      }),
    ).resolves.toBe(0);
  });

  it('returns higher congestion when rest is short and next 4 days are packed', async () => {
    const fixtureFindFirst = vi
      .fn()
      .mockResolvedValueOnce({
        scheduledAt: new Date('2026-03-02T12:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        scheduledAt: new Date('2026-03-02T12:00:00.000Z'),
      });
    const fixtureCount = vi.fn().mockResolvedValue(3);

    const prismaMock = {
      client: {
        fixture: {
          findFirst: fixtureFindFirst,
          count: fixtureCount,
        },
      },
    } as unknown as PrismaService;
    const service = new CongestionService(prismaMock);

    await expect(
      service.computeCongestionScore({
        homeTeamId: 'home',
        awayTeamId: 'away',
        fixtureDate: new Date('2026-03-03T12:00:00.000Z'),
      }),
    ).resolves.toBeCloseTo(0.8, 8);
  });
});
