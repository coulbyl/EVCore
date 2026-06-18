import { Injectable } from '@nestjs/common';
import { BetSource, BetStatus, StrategyChannel } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

const FIXTURE_INCLUDE = {
  homeTeam: { select: { name: true, logoUrl: true } },
  awayTeam: { select: { name: true, logoUrl: true } },
  season: {
    select: {
      competition: { select: { name: true, code: true } },
    },
  },
} as const;

export type BetWithFixture = {
  id: string;
  market: string;
  pick: string;
  comboMarket: string | null;
  comboPick: string | null;
  oddsSnapshot: { toString(): string } | null;
  ev: { toString(): string };
  status: string;
  fixture: {
    id: string;
    scheduledAt: Date;
    homeTeam: { name: string; logoUrl: string | null };
    awayTeam: { name: string; logoUrl: string | null };
    season: {
      competition: { name: string; code: string };
    };
  };
};

@Injectable()
export class SummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSettledBets(channel: StrategyChannel, from: Date, to: Date) {
    return this.prisma.client.bet.findMany({
      where: {
        channelSelection: {
          is: { channelDecision: { is: { channel } } },
        },
        source: BetSource.MODEL,
        status: { in: [BetStatus.WON, BetStatus.LOST] },
        fixture: {
          scheduledAt: { gte: from, lte: to },
        },
      },
      include: {
        fixture: {
          include: FIXTURE_INCLUDE,
        },
      },
      orderBy: { fixture: { scheduledAt: 'asc' } },
    }) as unknown as Promise<BetWithFixture[]>;
  }
}
