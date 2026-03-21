import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';

type LeagueBreakdownRow = {
  code: string;
  name: string;
  active: boolean;
  fixtures: bigint;
  finished: bigint;
  with_xg: bigint;
  with_odds: bigint;
  team_stats: bigint;
};

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getFixturesForDate(start: Date, end: Date) {
    return this.prisma.client.fixture.findMany({
      where: { scheduledAt: { gte: start, lte: end } },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        homeScore: true,
        awayScore: true,
        homeHtScore: true,
        awayHtScore: true,
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        season: {
          select: {
            competition: { select: { code: true, name: true } },
          },
        },
        oddsSnapshots: { select: { id: true }, take: 1 },
        modelRuns: {
          select: {
            decision: true,
            deterministicScore: true,
            finalScore: true,
            features: true,
            analyzedAt: true,
            bets: {
              select: {
                market: true,
                pick: true,
                ev: true,
                probEstimated: true,
              },
              orderBy: { ev: 'desc' },
              take: 1,
            },
          },
          orderBy: { analyzedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [
        { season: { competition: { name: 'asc' } } },
        { scheduledAt: 'asc' },
      ],
    });
  }

  async getOverviewData() {
    const [
      fixturesTotal,
      modelRunsTotal,
      betsTotal,
      couponsTotal,
      betsByStatus,
      betsByMarket,
      couponsByStatus,
      settledBets,
      adjustmentProposals,
      activeSuspensions,
      leagueBreakdown,
    ] = await Promise.all([
      this.prisma.client.fixture.count(),
      this.prisma.client.modelRun.count(),
      this.prisma.client.bet.count(),
      this.prisma.client.dailyCoupon.count(),
      this.prisma.client.bet.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.client.bet.groupBy({
        by: ['market'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.client.dailyCoupon.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.client.bet.count({
        where: { status: { in: ['WON', 'LOST', 'VOID'] } },
      }),
      this.prisma.client.adjustmentProposal.count(),
      this.prisma.client.marketSuspension.count({ where: { active: true } }),
      this.prisma.client.$queryRaw<LeagueBreakdownRow[]>`
        SELECT
          c.code,
          c.name,
          c."isActive"                                                    AS active,
          COUNT(DISTINCT f.id)                                            AS fixtures,
          COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'FINISHED')      AS finished,
          COUNT(DISTINCT f.id) FILTER (WHERE f."homeXg" IS NOT NULL)     AS with_xg,
          COUNT(DISTINCT o."fixtureId")                                   AS with_odds,
          COUNT(DISTINCT ts.id)                                           AS team_stats
        FROM competition c
        JOIN season      s  ON s."competitionId" = c.id
        LEFT JOIN fixture        f  ON f."seasonId" = s.id
        LEFT JOIN odds_snapshot  o  ON o."fixtureId" = f.id
        LEFT JOIN team_stats     ts ON ts."afterFixtureId" = f.id
        GROUP BY c.code, c.name, c."isActive"
        ORDER BY c."isActive" DESC, c.name
      `,
    ]);

    return {
      fixturesTotal,
      modelRunsTotal,
      betsTotal,
      couponsTotal,
      betsByStatus,
      betsByMarket,
      couponsByStatus,
      settledBets,
      adjustmentProposals,
      activeSuspensions,
      leagueBreakdown,
    };
  }
}
