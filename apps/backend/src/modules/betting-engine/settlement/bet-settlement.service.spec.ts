import { describe, it, expect, vi } from 'vitest';
import { BetStatus, FixtureStatus, Market } from '@evcore/db';
import { BetSettlementService } from './bet-settlement.service';
import type { PrismaService } from '@/prisma.service';

function makeHarness(betStatus: BetStatus, score = { home: 2, away: 1 }) {
  const update = vi.fn().mockResolvedValue(undefined);
  const tx = { bet: { update } };
  const prisma = {
    client: {
      fixture: {
        findUnique: vi.fn().mockResolvedValue({
          homeScore: score.home,
          awayScore: score.away,
          homeHtScore: 1,
          awayHtScore: 0,
          status: FixtureStatus.FINISHED,
        }),
      },
      bet: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'bet-1',
            market: Market.ONE_X_TWO,
            pick: 'HOME',
            status: betStatus,
          },
        ]),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    },
  } as unknown as PrismaService;
  return { service: new BetSettlementService(prisma), update, tx };
}

describe('BetSettlementService.settleOpenBets', () => {
  it('writes the status from the final score', async () => {
    const { service, update } = makeHarness(BetStatus.PENDING);
    await expect(service.settleOpenBets('fixture-1')).resolves.toEqual({
      settled: 1,
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'bet-1' },
      data: { status: BetStatus.WON },
    });
  });

  it('corrects an already settled bet on a later pass (VAR)', async () => {
    const { service, update } = makeHarness(BetStatus.WON, {
      home: 0,
      away: 1,
    });
    await service.settleOpenBets('fixture-1');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'bet-1' },
      data: { status: BetStatus.LOST },
    });
  });

  it('writes bet statuses and nothing else (no bankroll since 2026-10-31)', async () => {
    const { service, tx } = makeHarness(BetStatus.PENDING);
    await service.settleOpenBets('fixture-1');
    expect(Object.keys(tx)).toEqual(['bet']);
  });
});
