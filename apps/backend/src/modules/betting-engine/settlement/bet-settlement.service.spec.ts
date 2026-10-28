import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { BetStatus, FixtureStatus, Market } from '@evcore/db';
import { BetSettlementService } from './bet-settlement.service';
import type { PrismaService } from '@/prisma.service';
import type { BankrollService } from '@modules/bankroll/bankroll.service';

type ComboLeg = { status: BetStatus; odds: string | null };

function makeHarness(
  betStatus: BetStatus,
  opts: {
    comboLegs?: ComboLeg[];
    market?: Market;
    score?: { home: number; away: number };
  } = {},
) {
  const update = vi.fn().mockResolvedValue(undefined);
  const slipType = opts.comboLegs ? 'COMBO' : 'SINGLE';
  const comboSlips = opts.comboLegs
    ? [
        {
          id: 'slip-1',
          userId: 'user-1',
          unitStake: 400,
          items: opts.comboLegs.map((leg, index) => ({
            betId: `bet-${index + 1}`,
            bet: {
              status: leg.status,
              oddsSnapshot: leg.odds === null ? null : new Decimal(leg.odds),
            },
          })),
        },
      ]
    : [];
  const tx = {
    bet: { update },
    betSlip: { findMany: vi.fn().mockResolvedValue(comboSlips) },
  };
  const prisma = {
    client: {
      fixture: {
        findUnique: vi.fn().mockResolvedValue({
          homeScore: opts.score?.home ?? 2,
          awayScore: opts.score?.away ?? 1,
          homeHtScore: 1,
          awayHtScore: 0,
          status: FixtureStatus.FINISHED,
        }),
      },
      bet: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'bet-1',
            market: opts.market ?? Market.ONE_X_TWO,
            pick: 'HOME',
            status: betStatus,
            oddsSnapshot: new Decimal('2.0'),
            betSlipItems: [
              {
                userId: 'user-1',
                stakeOverride: null,
                betSlip: { id: 'slip-1', type: slipType, unitStake: 10 },
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

describe('BetSettlementService.settleOpenBets — combo crediting', () => {
  it('credits a won combo at the product of its legs', async () => {
    const { service, bankroll } = makeHarness(BetStatus.PENDING, {
      comboLegs: [
        { status: BetStatus.WON, odds: '2.0' },
        { status: BetStatus.WON, odds: '1.5' },
      ],
    });
    await service.settleOpenBets('fixture-1');
    expect(bankroll.recordBetWon).toHaveBeenCalledWith(
      expect.objectContaining({ odds: new Decimal('3'), betId: 'bet-1' }),
      expect.anything(),
    );
  });

  it('counts a refunded leg at odds 1 instead of losing the stake', async () => {
    // Prod case of 2026-09-04: 1.33 won + 1.57 refunded, never credited.
    const { service, bankroll } = makeHarness(BetStatus.PENDING, {
      comboLegs: [
        { status: BetStatus.WON, odds: '1.33' },
        { status: BetStatus.VOID, odds: '1.57' },
      ],
    });
    await service.settleOpenBets('fixture-1');
    expect(bankroll.recordBetWon).toHaveBeenCalledWith(
      expect.objectContaining({ odds: new Decimal('1.33') }),
      expect.anything(),
    );
    expect(bankroll.recordBetVoid).not.toHaveBeenCalled();
  });

  it('returns the stake when every leg is refunded', async () => {
    const { service, bankroll } = makeHarness(BetStatus.PENDING, {
      comboLegs: [
        { status: BetStatus.VOID, odds: '1.33' },
        { status: BetStatus.VOID, odds: '1.57' },
      ],
    });
    await service.settleOpenBets('fixture-1');
    expect(bankroll.recordBetVoid).toHaveBeenCalledWith(
      expect.objectContaining({ stake: new Decimal(400) }),
      expect.anything(),
    );
    expect(bankroll.recordBetWon).not.toHaveBeenCalled();
  });

  it('does not pay a credited combo again when a won leg is corrected to refunded', async () => {
    // Draw-no-bet leg first settled WON at 2-1, the combo was credited at
    // 2.0 × 1.5; the score is then corrected to 1-1.
    const { service, bankroll } = makeHarness(BetStatus.WON, {
      market: Market.DRAW_NO_BET,
      score: { home: 1, away: 1 },
      comboLegs: [
        { status: BetStatus.VOID, odds: '2.0' },
        { status: BetStatus.WON, odds: '1.5' },
      ],
    });
    await service.settleOpenBets('fixture-1');
    expect(bankroll.recordBetWon).not.toHaveBeenCalled();
    expect(bankroll.recordBetVoid).not.toHaveBeenCalled();
  });

  it('credits a combo whose lost leg is corrected to won', async () => {
    const { service, bankroll } = makeHarness(BetStatus.LOST, {
      comboLegs: [
        { status: BetStatus.WON, odds: '2.0' },
        { status: BetStatus.WON, odds: '1.5' },
      ],
    });
    await service.settleOpenBets('fixture-1');
    expect(bankroll.recordBetWon).toHaveBeenCalledTimes(1);
  });

  it('credits nothing while a leg is lost or still pending', async () => {
    for (const other of [BetStatus.LOST, BetStatus.PENDING]) {
      const { service, bankroll } = makeHarness(BetStatus.PENDING, {
        comboLegs: [
          { status: BetStatus.WON, odds: '2.0' },
          { status: other, odds: '1.5' },
        ],
      });
      await service.settleOpenBets('fixture-1');
      expect(bankroll.recordBetWon).not.toHaveBeenCalled();
      expect(bankroll.recordBetVoid).not.toHaveBeenCalled();
    }
  });
});
