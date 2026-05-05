import { Injectable } from '@nestjs/common';
import { BetSource, BetStatus, Market, PredictionChannel } from '@evcore/db';
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
  isSafeValue: boolean;
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

type OddsSnapshotRow = {
  homeOdds: { toString(): string } | null;
  drawOdds: { toString(): string } | null;
  awayOdds: { toString(): string } | null;
  pick: string | null;
  odds: { toString(): string } | null;
};

export type PredictionWithFixture = {
  id: string;
  channel: string;
  market: string;
  pick: string;
  probability: { toString(): string };
  correct: boolean;
  fixture: {
    id: string;
    scheduledAt: Date;
    homeTeam: { name: string; logoUrl: string | null };
    awayTeam: { name: string; logoUrl: string | null };
    season: {
      competition: { name: string; code: string };
    };
    oddsSnapshots: OddsSnapshotRow[];
  };
};

@Injectable()
export class SummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSettledBets(
    isSafeValue: boolean,
    from: Date,
    to: Date,
  ): Promise<BetWithFixture[]> {
    return this.prisma.client.bet.findMany({
      where: {
        isSafeValue,
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

  findSettledPredictions(
    channel: PredictionChannel,
    oddsMarket: Market,
    from: Date,
    to: Date,
  ): Promise<PredictionWithFixture[]> {
    return this.prisma.client.prediction.findMany({
      where: {
        channel,
        correct: { not: null },
        fixture: {
          scheduledAt: { gte: from, lte: to },
        },
      },
      include: {
        fixture: {
          include: {
            ...FIXTURE_INCLUDE,
            oddsSnapshots: {
              where: { market: oddsMarket },
              orderBy: { snapshotAt: 'desc' },
            },
          },
        },
      },
      orderBy: { fixture: { scheduledAt: 'asc' } },
    }) as unknown as Promise<PredictionWithFixture[]>;
  }
}
