import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

type DateRange = {
  from?: Date;
  to?: Date;
};

@Injectable()
export class ChatReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  searchFixtures(input: {
    query: string;
    range: DateRange;
    status?: string;
    limit: number;
  }) {
    const q = input.query;
    return this.prisma.client.fixture.findMany({
      where: {
        ...(input.status ? { status: input.status as any } : {}),
        ...(input.range.from || input.range.to
          ? {
              scheduledAt: {
                ...(input.range.from ? { gte: input.range.from } : {}),
                ...(input.range.to ? { lte: input.range.to } : {}),
              },
            }
          : {}),
        OR: [
          { homeTeam: { name: { contains: q, mode: 'insensitive' } } },
          { awayTeam: { name: { contains: q, mode: 'insensitive' } } },
          {
            season: {
              competition: {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { code: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      },
      orderBy: { scheduledAt: 'asc' },
      take: input.limit,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        season: {
          select: {
            competition: { select: { code: true, name: true, country: true } },
          },
        },
      },
    });
  }

  findFixtureForExplanation(fixtureId: string) {
    return this.prisma.client.fixture.findUnique({
      where: { id: fixtureId },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        season: {
          select: {
            competition: { select: { code: true, name: true, country: true } },
          },
        },
        modelRuns: {
          orderBy: { analyzedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            decision: true,
            finalScore: true,
            deterministicScore: true,
            mlDelta: true,
            scoreThreshold: true,
            evThreshold: true,
            features: true,
            analyzedAt: true,
            isBackfill: true,
            bets: {
              select: {
                id: true,
                market: true,
                pick: true,
                probEstimated: true,
                oddsSnapshot: true,
                ev: true,
                qualityScore: true,
                stakePct: true,
                status: true,
                isSafeValue: true,
              },
            },
          },
        },
        predictions: {
          select: {
            channel: true,
            market: true,
            pick: true,
            probability: true,
            correct: true,
          },
        },
        oddsSnapshots: {
          orderBy: { snapshotAt: 'desc' },
          take: 1,
          select: { snapshotAt: true },
        },
      },
    });
  }

  async findChannelLeagueHitRate(input: {
    canal: string;
    competitionCode: string;
    since: Date;
  }): Promise<number | null> {
    if (input.canal === 'EV' || input.canal === 'SV') {
      const rows = await this.prisma.client.bet.groupBy({
        by: ['status'],
        where: {
          source: 'MODEL',
          isSafeValue: input.canal === 'SV',
          status: { in: ['WON', 'LOST'] },
          fixture: {
            scheduledAt: { gte: input.since },
            season: { competition: { code: input.competitionCode } },
          },
        },
        _count: true,
      });
      return hitRateFromRows(rows);
    }

    const channel =
      input.canal === 'BB' ? 'BTTS' : input.canal === 'NUL' ? 'DRAW' : 'CONF';
    const rows = await this.prisma.client.prediction.groupBy({
      by: ['correct'],
      where: {
        channel: channel as any,
        correct: { not: null },
        fixture: {
          scheduledAt: { gte: input.since },
          season: { competition: { code: input.competitionCode } },
        },
      },
      _count: true,
    });
    const total = rows.reduce((sum, row) => sum + row._count, 0);
    if (total === 0) return null;
    const won = rows
      .filter((row) => row.correct === true)
      .reduce((sum, row) => sum + row._count, 0);
    return won / total;
  }
}

function hitRateFromRows(
  rows: Array<{ status: string; _count: number | Prisma.BatchPayload }>,
): number | null {
  const counts = rows.map((row) => ({
    status: row.status,
    count: typeof row._count === 'number' ? row._count : row._count.count,
  }));
  const total = counts.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return null;
  const won = counts
    .filter((row) => row.status === 'WON')
    .reduce((sum, row) => sum + row.count, 0);
  return won / total;
}
