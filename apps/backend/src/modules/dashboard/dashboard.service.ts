import { Injectable } from '@nestjs/common';
import { Decision } from '@evcore/db';
import { toNumber } from '@utils/prisma.utils';
import {
  startOfUtcDay,
  endOfUtcDay,
  formatTimeUtc,
  formatTimeWithSecondsUtc,
} from '@utils/date.utils';
import {
  signedDelta,
  formatSigned,
  toQualityScore,
  couponWindow,
  buildWorkerStatus,
  uniqueBetsByFixture,
  notificationSeverity,
  notificationLevel,
} from './dashboard.utils';
import { DashboardRepository } from './dashboard.repository';
import type {
  DashboardSummary,
  CouponSnapshot,
  OpportunityRow,
  WorkerStatus,
  FixturePanel,
} from './dashboard.types';

type SummaryData = Awaited<ReturnType<DashboardRepository['getSummaryData']>>;
type TopBet = SummaryData['topBets'][number];
type RecentCoupon = SummaryData['recentCoupons'][number];
type UnreadNotification = SummaryData['unreadNotifications'][number];
type ActivityNotification = SummaryData['activityNotifications'][number];

@Injectable()
export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  async getSummary(): Promise<DashboardSummary> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86_400_000);
    const data = await this.repo.getSummaryData(
      { start: startOfUtcDay(now), end: endOfUtcDay(now) },
      { start: startOfUtcDay(yesterday), end: endOfUtcDay(yesterday) },
      yesterday,
    );
    const uniqueTopBets = uniqueBetsByFixture(data.topBets).slice(0, 4);

    return {
      dashboardKpis: this.buildKpis(data),
      workerStatuses: this.buildWorkerStatuses(data),
      activeAlerts: this.buildActiveAlerts(data.unreadNotifications),
      couponSnapshots: this.buildCouponSnapshots(data.recentCoupons, now),
      topOpportunities: this.buildTopOpportunities(uniqueTopBets),
      selectedFixture: this.buildSelectedFixture(uniqueTopBets),
      activityFeed: this.buildActivityFeed(data.activityNotifications),
    };
  }

  // ---------------------------------------------------------------------------
  // Section builders
  // ---------------------------------------------------------------------------

  private buildKpis(data: SummaryData): DashboardSummary['dashboardKpis'] {
    const decisionMap = new Map<Decision, number>();
    for (const row of data.betDecisionsToday) {
      decisionMap.set(row.decision, row._count._all);
    }
    const betCount = decisionMap.get(Decision.BET) ?? 0;
    const coveragePct =
      data.scheduledToday > 0
        ? (data.fixturesWithOddsToday / data.scheduledToday) * 100
        : 0;

    return [
      {
        label: 'Matchs planifiés',
        value: String(data.scheduledToday),
        delta: `${signedDelta(data.scheduledToday - data.scheduledYesterday)} vs hier`,
        tone: 'accent',
      },
      {
        label: 'Matchs avec cotes',
        value: String(data.fixturesWithOddsToday),
        delta: `${coveragePct.toFixed(1).replace('.', ',')}% de couverture`,
        tone: 'success',
      },
      {
        label: 'Scorings du jour',
        value: String(betCount),
        delta: `${data.modelRunsToday} analysés`,
        tone: 'warning',
      },
      {
        label: 'Alertes actives',
        value: String(data.unreadNotificationsTotal).padStart(2, '0'),
        delta: `${data.unreadHighAlertsTotal} haute priorité`,
        tone: 'danger',
      },
    ];
  }

  private buildWorkerStatuses(data: SummaryData): WorkerStatus[] {
    return [
      buildWorkerStatus({
        worker: 'fixtures-sync',
        lastRun: data.latestFixture?.updatedAt ?? null,
        healthyMinutes: 20,
        watchMinutes: 60,
        detail: `${data.scheduledToday} matchs planifiés aujourd'hui`,
        formatTime: formatTimeUtc,
      }),
      buildWorkerStatus({
        worker: 'odds-live-sync',
        lastRun: data.latestOddsSnapshot?.snapshotAt ?? null,
        healthyMinutes: 10,
        watchMinutes: 30,
        detail: `${data.fixturesWithOddsToday} matchs avec snapshot de cotes`,
        formatTime: formatTimeUtc,
      }),
      buildWorkerStatus({
        worker: 'injuries-sync',
        lastRun: data.latestTeamStats?.createdAt ?? null,
        healthyMinutes: 120,
        watchMinutes: 360,
        detail: 'Stats équipe calculées (proxy disponibilité injuries)',
        formatTime: formatTimeUtc,
      }),
      buildWorkerStatus({
        worker: 'coupon-worker',
        lastRun: data.latestCoupon?.createdAt ?? null,
        healthyMinutes: 120,
        watchMinutes: 360,
        detail: `${data.recentCoupons.length} coupons détectés`,
        formatTime: formatTimeUtc,
      }),
    ];
  }

  private buildActiveAlerts(
    notifications: UnreadNotification[],
  ): DashboardSummary['activeAlerts'] {
    const byTypeAndDay = new Map<string, UnreadNotification>();

    for (const notification of notifications) {
      const day = notification.createdAt.toISOString().slice(0, 10);
      const key = `${notification.type}-${day}`;
      if (!byTypeAndDay.has(key)) {
        byTypeAndDay.set(key, notification);
      }
    }

    return Array.from(byTypeAndDay.values())
      .slice(0, 3)
      .map((n) => ({
        id: n.id,
        title: n.title,
        detail: this.sanitizeAlertDetail(n.body),
        severity: notificationSeverity(n.type),
      }));
  }

  private buildCouponSnapshots(
    coupons: RecentCoupon[],
    now: Date,
  ): CouponSnapshot[] {
    return coupons.map((coupon) => {
      const avgEv =
        coupon.bets.length > 0
          ? coupon.bets.reduce((acc, bet) => acc + toNumber(bet.ev), 0) /
            coupon.bets.length
          : 0;
      return {
        id: coupon.id,
        code: coupon.code,
        status:
          coupon.status === 'WON' || coupon.status === 'LOST'
            ? coupon.status
            : 'PENDING',
        legs: coupon.bets.length,
        ev: formatSigned(avgEv, 2),
        window: couponWindow(coupon.date, now),
        selections: coupon.bets.map((bet) => {
          const comboParts = [bet.pick];
          if (bet.comboMarket && bet.comboPick) {
            comboParts.push(`${bet.comboMarket} ${bet.comboPick}`);
          }

          return {
            id: bet.id,
            fixture: `${bet.modelRun.fixture.homeTeam.name} vs ${bet.modelRun.fixture.awayTeam.name}`,
            scheduledAt: formatTimeUtc(bet.modelRun.fixture.scheduledAt),
            market: bet.market,
            pick: comboParts.join(' + '),
            odds: toNumber(bet.oddsSnapshot).toFixed(2),
            ev: formatSigned(toNumber(bet.ev), 3),
          };
        }),
      };
    });
  }

  private buildTopOpportunities(uniqueTopBets: TopBet[]): OpportunityRow[] {
    return uniqueTopBets.map((bet) => {
      const fixture = bet.modelRun.fixture;
      return {
        id: bet.id,
        fixture: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
        competition: fixture.season.competition.name,
        kickoff: formatTimeUtc(fixture.scheduledAt),
        market: bet.market,
        pick: bet.pick,
        odds:
          bet.oddsSnapshot != null
            ? toNumber(bet.oddsSnapshot).toFixed(2)
            : '-',
        ev: formatSigned(toNumber(bet.ev), 3),
        quality: String(toQualityScore(bet.modelRun.finalScore)),
        deterministic: toNumber(bet.modelRun.deterministicScore).toFixed(2),
        decision: bet.modelRun.decision,
      };
    });
  }

  private buildSelectedFixture(uniqueTopBets: TopBet[]): FixturePanel {
    const bet = uniqueTopBets[0];
    if (!bet) {
      return {
        fixture: 'Aucun match',
        competition: '-',
        startTime: '--:--',
        market: '-',
        pick: '-',
        modelConfidence: 'Aucune donnée disponible.',
        notes: ['Aucun run modèle disponible.'],
        metrics: [
          { label: 'EV', value: '+0.000', tone: 'accent' },
          { label: 'Qualité', value: '0', tone: 'success' },
          { label: 'Déterministe', value: '0.00', tone: 'warning' },
          { label: 'Cotes', value: '0.00', tone: 'neutral' },
        ],
      };
    }

    const fixture = bet.modelRun.fixture;
    return {
      fixture: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
      competition: fixture.season.competition.name,
      startTime: formatTimeUtc(fixture.scheduledAt),
      market: bet.market,
      pick: bet.pick,
      modelConfidence:
        'Sélection calculée à partir des dernières exécutions du modèle.',
      notes: [
        `runId ${bet.modelRunId.slice(0, 8)}`,
        `score final ${toNumber(bet.modelRun.finalScore).toFixed(3)}`,
        `stake ${toNumber(bet.stakePct).toFixed(3)}`,
      ],
      metrics: [
        {
          label: 'EV',
          value: formatSigned(toNumber(bet.ev), 3),
          tone: 'accent',
        },
        {
          label: 'Qualité',
          value: String(toQualityScore(bet.modelRun.finalScore)),
          tone: 'success',
        },
        {
          label: 'Déterministe',
          value: toNumber(bet.modelRun.deterministicScore).toFixed(2),
          tone: 'warning',
        },
        {
          label: 'Cotes',
          value:
            bet.oddsSnapshot != null
              ? toNumber(bet.oddsSnapshot).toFixed(2)
              : '-',
          tone: 'neutral',
        },
      ],
    };
  }

  private buildActivityFeed(
    notifications: ActivityNotification[],
  ): DashboardSummary['activityFeed'] {
    return notifications.map((n) => ({
      time: formatTimeWithSecondsUtc(n.createdAt),
      level: notificationLevel(n.type),
      message: n.title,
    }));
  }

  private sanitizeAlertDetail(body: string): string {
    const normalized = body.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 180) return normalized;
    return `${normalized.slice(0, 177)}...`;
  }
}
