import { describe, expect, it, vi } from 'vitest';
import { StrategyChannel } from '@evcore/db';
import type { PrismaService } from '@/prisma.service';
import { DashboardRepository } from './dashboard.repository';

describe('DashboardRepository.findChannelSelectionsInRange', () => {
  it('splits a large point-in-time cohort into sequential Prisma queries', async () => {
    const cohort = Array.from({ length: 20_001 }, (_, index) => ({
      id: `selection-${index}`,
    }));
    const requestedBatches: string[][] = [];
    const findMany = vi
      .fn()
      .mockImplementation((args: { where: { id: { in: string[] } } }) => {
        requestedBatches.push(args.where.id.in);
        return Promise.resolve(
          args.where.id.in.map((id) => ({ result: 'WON', marker: id })),
        );
      });
    const prisma = {
      client: {
        $queryRaw: vi.fn().mockResolvedValue(cohort),
        channelSelection: { findMany },
      },
    } as unknown as PrismaService;
    const repository = new DashboardRepository(prisma);

    const rows = await repository.findChannelSelectionsInRange(
      [StrategyChannel.VALUE],
      {
        since: new Date('2020-01-01T00:00:00.000Z'),
        until: new Date('2026-09-22T23:59:59.999Z'),
      },
    );

    expect(requestedBatches.map((batch) => batch.length)).toEqual([
      10_000, 10_000, 1,
    ]);
    expect(findMany).toHaveBeenCalledTimes(3);
    expect(rows).toHaveLength(20_001);
  });

  it('does not query channel selections when the cohort is empty', async () => {
    const findMany = vi.fn();
    const prisma = {
      client: {
        $queryRaw: vi.fn().mockResolvedValue([]),
        channelSelection: { findMany },
      },
    } as unknown as PrismaService;
    const repository = new DashboardRepository(prisma);

    const rows = await repository.findChannelSelectionsInRange(
      [StrategyChannel.VALUE],
      {
        since: new Date('2026-09-22T00:00:00.000Z'),
        until: new Date('2026-09-22T23:59:59.999Z'),
      },
    );

    expect(findMany).not.toHaveBeenCalled();
    expect(rows).toEqual([]);
  });
});
