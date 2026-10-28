import { Injectable } from '@nestjs/common';
import { type BetSlipType, BetStatus, type Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import {
  PlayableOddsRepository,
  type PlayableQuote,
  type PlayableQuoteKey,
} from '../betting-engine/pricing/playable-odds.repository';

export type PlayedSlipRow = {
  type: BetSlipType;
  unitStake: Prisma.Decimal;
  createdAt: Date;
  items: {
    stakeOverride: Prisma.Decimal | null;
    bet: { status: BetStatus; oddsSnapshot: Prisma.Decimal | null };
  }[];
};

@Injectable()
export class BetSlipRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playableOdds: PlayableOddsRepository,
  ) {}

  /** Prix chez le book de l'utilisateur (1xBet) pour chaque choix d'un
   * ticket — voir BetSlipService.create. */
  findPlayableQuotes(
    keys: readonly PlayableQuoteKey[],
  ): Promise<Map<string, PlayableQuote>> {
    return this.playableOdds.findPlayableQuotes(keys);
  }

  findUserBetSlips(userId: string, from?: Date, to?: Date) {
    return this.prisma.client.betSlip.findMany({
      where: {
        userId,
        ...((from ?? to)
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            bet: {
              select: {
                id: true,
                market: true,
                pick: true,
                ev: true,
                oddsSnapshot: true,
                status: true,
                channelSelection: {
                  select: { channelDecision: { select: { channel: true } } },
                },
              },
            },
            fixture: {
              select: {
                id: true,
                homeTeam: { select: { name: true } },
                awayTeam: { select: { name: true } },
                homeScore: true,
                awayScore: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  async getUserSummary(userId: string, from?: Date, to?: Date) {
    const fixtureFilter =
      from || to
        ? {
            scheduledAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : undefined;
    const itemWhere = (status: BetStatus) => ({
      userId,
      bet: { status },
      ...(fixtureFilter ? { fixture: fixtureFilter } : {}),
    });

    const [slipCount, wonBets, lostBets, pendingBets] = await Promise.all([
      this.prisma.client.betSlip.count({ where: { userId } }),
      this.prisma.client.betSlipItem.count({ where: itemWhere('WON') }),
      this.prisma.client.betSlipItem.count({ where: itemWhere('LOST') }),
      this.prisma.client.betSlipItem.count({ where: itemWhere('PENDING') }),
    ]);
    return { slipCount, wonBets, lostBets, pendingBets };
  }

  /**
   * Les coupons de l'utilisateur avec le statut et la cote de chaque jambe :
   * de quoi calculer son résultat à mise fixe (`fixedStakeOutcome`). Même
   * filtre de dates que `getUserSummary` (date des matchs), au niveau du
   * coupon : un coupon dont une jambe tombe dans la fenêtre y entre.
   */
  getUserPlayedSlips(
    userId: string,
    from?: Date,
    to?: Date,
  ): Promise<PlayedSlipRow[]> {
    const fixtureFilter =
      from || to
        ? {
            scheduledAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : undefined;
    return this.prisma.client.betSlip.findMany({
      where: {
        userId,
        ...(fixtureFilter
          ? { items: { some: { fixture: fixtureFilter } } }
          : {}),
      },
      select: {
        type: true,
        unitStake: true,
        createdAt: true,
        items: {
          select: {
            stakeOverride: true,
            bet: { select: { status: true, oddsSnapshot: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  findUserBetSlipById(userId: string, betSlipId: string) {
    return this.prisma.client.betSlip.findFirst({
      where: { id: betSlipId, userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            bet: {
              select: {
                id: true,
                market: true,
                pick: true,
                ev: true,
                oddsSnapshot: true,
                status: true,
                channelSelection: {
                  select: { channelDecision: { select: { channel: true } } },
                },
              },
            },
            fixture: {
              select: {
                id: true,
                homeTeam: { select: { name: true } },
                awayTeam: { select: { name: true } },
                homeScore: true,
                awayScore: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }
}
