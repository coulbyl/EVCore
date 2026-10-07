import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { BetStatus, FixtureStatus, Market } from '@evcore/db';
import { BetSettlementService } from './bet-settlement.service';
import type { PrismaService } from '@/prisma.service';
import type { BankrollService } from '@modules/bankroll/bankroll.service';

function makeHarness(betStatus: BetStatus) {
  const update = vi.fn().mockResolvedValue(undefined);
  const tx = {
    bet: { update },
    betSlip: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const prisma = {
    client: {
      fixture: {
        findUnique: vi.fn().mockResolvedValue({
          homeScore: 2,
          awayScore: 1,
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
            oddsSnapshot: new Decimal('2.0'),
            betSlipItems: [
              {
                userId: 'user-1',
                stakeOverride: null,
                betSlip: { id: 'slip-1', type: 'SINGLE', unitStake: 10 },
              },
            ],
          },
        ]),
      },
      user: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'user-1', currency: 'EUR' }]),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    },
  } as unknown as PrismaService;
  const bankroll = {
    recordBetWon: vi.fn().mockResolvedValue(undefined),
    recordBetVoid: vi.fn().mockResolvedValue(undefined),
  } as unknown as BankrollService;
  return {
    service: new BetSettlementService(prisma, undefined, bankroll),
    bankroll,
    update,
  };
}

describe('BetSettlementService.settleOpenBets — bankroll credits only on a status transition', () => {
  it('credits a PENDING bet that resolves to WON', async () => {
    const { service, bankroll } = makeHarness(BetStatus.PENDING);
    await service.settleOpenBets('fixture-1');
    expect(bankroll.recordBetWon).toHaveBeenCalledTimes(1);
  });

  it('does not credit again a bet that was already WON (re-settlement pass)', async () => {
    const { service, bankroll, update } = makeHarness(BetStatus.WON);
    await service.settleOpenBets('fixture-1');
    expect(bankroll.recordBetWon).not.toHaveBeenCalled();
    // The status itself is still rewritten (VAR self-correction path).
    expect(update).toHaveBeenCalledTimes(1);
  });
});
