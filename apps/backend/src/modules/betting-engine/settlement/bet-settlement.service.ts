import { Injectable, Optional } from '@nestjs/common';
import { BetStatus, FixtureStatus, Market } from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';
import { BankrollService } from '@modules/bankroll/bankroll.service';
import { ChannelDecisionService } from '../channel-decision.service';
import {
  resolveEarlyBetStatus,
  resolveFirstHalfBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolvePickBetStatus,
  resolveWinEitherHalfBetStatus,
} from '../betting-engine.utils';

/**
 * Settles materialised Bets against final/early fixture scores and mirrors the
 * outcome onto channel selections. Bet.status is the financial authority; the
 * channel mirror is analytical only. Extracted verbatim from BettingEngineService.
 */
@Injectable()
export class BetSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly channelDecisionService?: ChannelDecisionService,
    @Optional()
    private readonly bankroll?: BankrollService,
  ) {}

  async settleEarlyBets(fixtureId: string): Promise<{ settled: number }> {
    const fixture = await this.prisma.client.fixture.findUnique({
      where: { id: fixtureId },
      select: {
        homeScore: true,
        awayScore: true,
        homeHtScore: true,
        awayHtScore: true,
      },
    });

    if (!fixture || fixture.homeScore === null || fixture.awayScore === null) {
      return { settled: 0 };
    }

    const bets = await this.prisma.client.bet.findMany({
      where: { fixtureId, status: BetStatus.PENDING },
      select: {
        id: true,
        market: true,
        pick: true,
      },
    });

    let settled = 0;
    for (const bet of bets) {
      const status = resolveEarlyBetStatus({
        market: bet.market,
        pick: bet.pick,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        homeHtScore: fixture.homeHtScore,
        awayHtScore: fixture.awayHtScore,
      });

      if (status === null) continue;
      await this.prisma.client.bet.update({
        where: { id: bet.id },
        data: { status },
      });
      settled++;
    }

    // Analytical mirror — early-settle channel selections (no bankroll effect).
    await this.channelDecisionService?.settleFixtureSelections({
      fixtureId,
      scores: {
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        homeHtScore: fixture.homeHtScore,
        awayHtScore: fixture.awayHtScore,
      },
      mode: 'early',
    });

    return { settled };
  }

  async settleOpenBets(fixtureId: string): Promise<{ settled: number }> {
    const fixture = await this.prisma.client.fixture.findUnique({
      where: { id: fixtureId },
      select: {
        homeScore: true,
        awayScore: true,
        homeHtScore: true,
        awayHtScore: true,
        status: true,
      },
    });

    if (!fixture || fixture.status !== FixtureStatus.FINISHED) {
      return { settled: 0 };
    }

    // Re-settle all bets (PENDING + already early-settled) using the definitive
    // final score — this corrects any VAR-reversed early settlements automatically.
    const bets = await this.prisma.client.bet.findMany({
      where: {
        fixtureId,
        status: { in: [BetStatus.PENDING, BetStatus.WON, BetStatus.LOST] },
      },
      select: {
        id: true,
        market: true,
        pick: true,
        oddsSnapshot: true,
        betSlipItems: {
          select: {
            userId: true,
            stakeOverride: true,
            betSlip: {
              select: {
                id: true,
                type: true,
                unitStake: true,
              },
            },
          },
        },
      },
    });

    // Analytical mirror — final-settle every channel selection (even when no Bet
    // was materialised, e.g. DOMINANT/DRAW/BTTS). Runs before the no-bets return.
    if (fixture.homeScore !== null && fixture.awayScore !== null) {
      await this.channelDecisionService?.settleFixtureSelections({
        fixtureId,
        scores: {
          homeScore: fixture.homeScore,
          awayScore: fixture.awayScore,
          homeHtScore: fixture.homeHtScore,
          awayHtScore: fixture.awayHtScore,
        },
        mode: 'final',
      });
    }

    if (bets.length === 0) return { settled: 0 };

    const userIds = [
      ...new Set(bets.flatMap((b) => b.betSlipItems.map((i) => i.userId))),
    ];
    const users = await this.prisma.client.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, currency: true },
    });
    const currencyByUser = new Map(users.map((u) => [u.id, u.currency]));

    return this.prisma.client.$transaction(async (tx) => {
      let settled = 0;
      const touchedComboSlipIds = new Set<string>();
      for (const bet of bets) {
        let status: BetStatus;

        if (bet.market === Market.HALF_TIME_FULL_TIME) {
          status = resolveHalfTimeFullTimeBetStatus({
            pick: bet.pick,
            homeHtScore: fixture.homeHtScore,
            awayHtScore: fixture.awayHtScore,
            homeScore: fixture.homeScore,
            awayScore: fixture.awayScore,
          });
        } else if (
          bet.market === Market.OVER_UNDER_HT ||
          bet.market === Market.FIRST_HALF_WINNER
        ) {
          status = resolveFirstHalfBetStatus(
            bet.pick,
            fixture.homeHtScore,
            fixture.awayHtScore,
          );
        } else if (bet.market === Market.TO_WIN_EITHER_HALF) {
          status = resolveWinEitherHalfBetStatus(
            bet.pick,
            fixture.homeHtScore,
            fixture.awayHtScore,
            fixture.homeScore,
            fixture.awayScore,
          );
        } else {
          status = resolvePickBetStatus(
            bet.market,
            bet.pick,
            fixture.homeScore,
            fixture.awayScore,
          );
        }

        await tx.bet.update({
          where: { id: bet.id },
          data: { status },
        });

        if (status === BetStatus.WON || status === BetStatus.VOID) {
          for (const item of bet.betSlipItems) {
            if (item.betSlip.type === 'COMBO') {
              touchedComboSlipIds.add(item.betSlip.id);
              continue;
            }

            const stake = new Decimal(
              (item.stakeOverride ?? item.betSlip.unitStake).toString(),
            );

            if (status === BetStatus.WON) {
              if (bet.oddsSnapshot === null) {
                throw new Error(
                  `Impossible de créditer le bet ${bet.id} sans oddsSnapshot`,
                );
              }

              await this.bankroll?.recordBetWon(
                {
                  userId: item.userId,
                  betId: bet.id,
                  stake,
                  odds: new Decimal(bet.oddsSnapshot.toString()),
                  currency: currencyByUser.get(item.userId),
                },
                { tx },
              );
              continue;
            }

            await this.bankroll?.recordBetVoid(
              {
                userId: item.userId,
                betId: bet.id,
                stake,
              },
              { tx },
            );
          }
        }

        settled++;
      }

      if (touchedComboSlipIds.size > 0) {
        const comboSlips = await tx.betSlip.findMany({
          where: { id: { in: [...touchedComboSlipIds] }, type: 'COMBO' },
          select: {
            id: true,
            userId: true,
            unitStake: true,
            items: {
              select: {
                betId: true,
                bet: {
                  select: {
                    status: true,
                    oddsSnapshot: true,
                  },
                },
              },
            },
          },
        });

        for (const slip of comboSlips) {
          if (
            slip.items.some((item) => item.bet.status === BetStatus.PENDING)
          ) {
            continue;
          }

          if (slip.items.every((item) => item.bet.status === BetStatus.WON)) {
            const totalOdds = slip.items.reduce((product, item) => {
              if (item.bet.oddsSnapshot === null) {
                throw new Error(
                  `Impossible de créditer le coupon combiné ${slip.id} sans oddsSnapshot`,
                );
              }
              return product.times(item.bet.oddsSnapshot.toString());
            }, new Decimal(1));

            await this.bankroll?.recordBetWon(
              {
                userId: slip.userId,
                betId: slip.items[0].betId,
                stake: new Decimal(slip.unitStake.toString()),
                odds: totalOdds,
                currency: currencyByUser.get(slip.userId),
              },
              { tx },
            );
          }
        }
      }

      return { settled };
    });
  }
}
