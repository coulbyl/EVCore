import { Injectable } from '@nestjs/common';
import { BetStatus, FixtureStatus, NotificationType } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummaryData(opts: {
    today: { start: Date; end: Date };
    yesterday: { start: Date; end: Date };
    pnlDateRange?: { start: Date; end: Date };
  }) {
    const { today, yesterday, pnlDateRange } = opts;
    const { start: todayStart, end: todayEnd } = today;
    const { start: yesterdayStart, end: yesterdayEnd } = yesterday;

    const [
      scheduledToday,
      scheduledYesterday,
      fixturesWithOddsToday,
      modelRunsToday,
      betDecisionsToday,
      unreadNotificationsTotal,
      unreadHighAlertsTotal,
      unreadNotifications,
      topBets,
      activityNotifications,
      latestFixture,
      latestOddsSnapshot,
      latestTeamStats,
      settledBets,
    ] = await Promise.all([
      this.prisma.client.fixture.count({
        where: {
          status: { in: [FixtureStatus.SCHEDULED, FixtureStatus.IN_PROGRESS] },
          scheduledAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.client.fixture.count({
        where: {
          status: { in: [FixtureStatus.SCHEDULED, FixtureStatus.IN_PROGRESS] },
          scheduledAt: { gte: yesterdayStart, lte: yesterdayEnd },
        },
      }),
      this.prisma.client.fixture.count({
        where: {
          status: { in: [FixtureStatus.SCHEDULED, FixtureStatus.IN_PROGRESS] },
          scheduledAt: { gte: todayStart, lte: todayEnd },
          oddsSnapshots: { some: {} },
        },
      }),
      this.prisma.client.modelRun.count({
        where: { analyzedAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.client.modelRun.groupBy({
        by: ['decision'],
        where: { analyzedAt: { gte: todayStart, lte: todayEnd } },
        _count: { _all: true },
      }),
      this.prisma.client.notification.count({
        where: { read: false },
      }),
      this.prisma.client.notification.count({
        where: {
          read: false,
          type: {
            in: [
              NotificationType.ETL_FAILURE,
              NotificationType.MARKET_SUSPENSION,
            ],
          },
        },
      }),
      this.prisma.client.notification.findMany({
        where: {
          read: false,
          type: {
            in: [
              NotificationType.ETL_FAILURE,
              NotificationType.MARKET_SUSPENSION,
              NotificationType.ROI_ALERT,
              NotificationType.BRIER_ALERT,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      this.prisma.client.bet.findMany({
        where: {
          modelRun: {
            fixture: {
              status: {
                in: [FixtureStatus.SCHEDULED, FixtureStatus.IN_PROGRESS],
              },
              scheduledAt: { gte: todayStart, lte: todayEnd },
            },
          },
        },
        orderBy: { ev: 'desc' },
        take: 12,
        include: {
          modelRun: {
            include: {
              fixture: {
                include: {
                  season: { include: { competition: true } },
                  homeTeam: true,
                  awayTeam: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.client.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.client.fixture.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      this.prisma.client.oddsSnapshot.findFirst({
        orderBy: { snapshotAt: 'desc' },
        select: { snapshotAt: true },
      }),
      this.prisma.client.teamStats.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.client.bet.findMany({
        where: {
          status: { in: [BetStatus.WON, BetStatus.LOST] },
          ...(pnlDateRange
            ? {
                modelRun: {
                  fixture: {
                    scheduledAt: {
                      gte: pnlDateRange.start,
                      lte: pnlDateRange.end,
                    },
                  },
                },
              }
            : {}),
        },
        select: {
          status: true,
          stakePct: true,
          oddsSnapshot: true,
        },
      }),
    ]);

    return {
      scheduledToday,
      scheduledYesterday,
      fixturesWithOddsToday,
      modelRunsToday,
      betDecisionsToday,
      unreadNotificationsTotal,
      unreadHighAlertsTotal,
      unreadNotifications,
      topBets,
      activityNotifications,
      latestFixture,
      latestOddsSnapshot,
      latestTeamStats,
      settledBets,
    };
  }
}
