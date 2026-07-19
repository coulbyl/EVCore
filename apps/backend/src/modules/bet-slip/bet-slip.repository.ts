import { Injectable } from '@nestjs/common';
import { BetSource, BetStatus, StrategyChannel } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

@Injectable()
export class BetSlipRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  getGlobalModelBets(from?: Date, to?: Date) {
    const fixtureFilter =
      from || to
        ? {
            scheduledAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : undefined;
    return this.prisma.client.bet.findMany({
      where: {
        source: BetSource.MODEL,
        channelSelection: {
          is: {
            channelDecision: { is: { channel: StrategyChannel.VALUE } },
          },
        },
        status: { in: ['WON', 'LOST'] },
        oddsSnapshot: { not: null },
        ...(fixtureFilter ? { fixture: fixtureFilter } : {}),
      },
      select: {
        status: true,
        oddsSnapshot: true,
        stakePct: true,
      },
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
