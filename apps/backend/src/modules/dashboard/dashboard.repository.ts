import { Injectable } from '@nestjs/common';
import { FixtureStatus, NotificationType } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummaryData(
    today: { start: Date; end: Date },
    yesterday: { start: Date; end: Date },
    rolling24hStart: Date,
  ) {
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
      recentCoupons,
      topBets,
      activityNotifications,
      latestFixture,
      latestOddsSnapshot,
      latestTeamStats,
      latestCoupon,
    ] = await Promise.all([
      this.prisma.client.fixture.count({
        where: {
          status: FixtureStatus.SCHEDULED,
          scheduledAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.client.fixture.count({
        where: {
          status: FixtureStatus.SCHEDULED,
          scheduledAt: { gte: yesterdayStart, lte: yesterdayEnd },
        },
      }),
      this.prisma.client.fixture.count({
        where: {
          status: FixtureStatus.SCHEDULED,
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
      this.prisma.client.dailyCoupon.findMany({
        where: { bets: { some: {} } },
        orderBy: { date: 'desc' },
        take: 8,
        include: {
          bets: {
            select: {
              id: true,
              market: true,
              pick: true,
              comboMarket: true,
              comboPick: true,
              oddsSnapshot: true,
              ev: true,
              modelRun: {
                select: {
                  fixture: {
                    select: {
                      scheduledAt: true,
                      homeTeam: { select: { name: true } },
                      awayTeam: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.client.bet.findMany({
        where: {
          modelRun: {
            analyzedAt: { gte: rolling24hStart },
            fixture: { status: FixtureStatus.SCHEDULED },
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
      this.prisma.client.dailyCoupon.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
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
      recentCoupons,
      topBets,
      activityNotifications,
      latestFixture,
      latestOddsSnapshot,
      latestTeamStats,
      latestCoupon,
    };
  }
}
