import { Injectable, Optional } from '@nestjs/common';
import { BetStatus, FixtureStatus, Market } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
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
 * outcome onto channel selections. The channel mirror is analytical only.
 * Since the declared slips and the bankroll left (2026-10-31), a settlement
 * writes statuses and nothing else: no money moves here.
 */
@Injectable()
export class BetSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly channelDecisionService?: ChannelDecisionService,
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

    return this.prisma.client.$transaction(async (tx) => {
      let settled = 0;
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

        settled++;
      }

      return { settled };
    });
  }
}
