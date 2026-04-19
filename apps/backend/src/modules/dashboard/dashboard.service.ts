import { Injectable } from '@nestjs/common';
import { Decision } from '@evcore/db';
import Decimal from 'decimal.js';
import { toNumber } from '@utils/prisma.utils';
import {
  startOfUtcDay,
  endOfUtcDay,
  formatTimeUtc,
  parseIsoDate,
} from '@utils/date.utils';
import {
  signedDelta,
  formatSigned,
  buildWorkerStatus,
  notificationSeverity,
} from './dashboard.utils';
import { DashboardRepository } from './dashboard.repository';
import type {
  CompetitionStat,
  DashboardSummary,
  LeaderboardEntry,
  PnlSummary,
  WorkerStatus,
} from './dashboard.types';

const MIN_SETTLED_MODEL = 10;
const MIN_SETTLED_USER = 5;

type SummaryData = Awaited<ReturnType<DashboardRepository['getSummaryData']>>;
type UnreadNotification = SummaryData['unreadNotifications'][number];

@Injectable()
export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  async getSummary(pnlDate?: string): Promise<DashboardSummary> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86_400_000);
    const pnlDay = pnlDate ? parseIsoDate(pnlDate) : undefined;
    const data = await this.repo.getSummaryData({
      today: { start: startOfUtcDay(now), end: endOfUtcDay(now) },
      yesterday: {
        start: startOfUtcDay(yesterday),
        end: endOfUtcDay(yesterday),
      },
      pnlDateRange: pnlDay
        ? { start: startOfUtcDay(pnlDay), end: endOfUtcDay(pnlDay) }
        : undefined,
    });
    return {
      dashboardKpis: this.buildKpis(data),
      workerStatuses: this.buildWorkerStatuses(data),
      activeAlerts: this.buildActiveAlerts(data.unreadNotifications),
      pnlSummary: this.buildPnlSummary(data.settledBets),
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
        worker: 'odds-prematch-sync',
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

  private buildPnlSummary(settled: SummaryData['settledBets']): PnlSummary {
    const won = settled.filter((b) => b.status === 'WON');
    const lost = settled.filter((b) => b.status === 'LOST');
    const settledCount = won.length + lost.length;

    const totalStaked = settled.reduce(
      (acc, b) => acc + toNumber(b.stakePct),
      0,
    );
    const totalReturned = won.reduce(
      (acc, b) => acc + toNumber(b.stakePct) * toNumber(b.oddsSnapshot ?? 1),
      0,
    );
    const netUnits = totalReturned - totalStaked;
    const roi = totalStaked > 0 ? (netUnits / totalStaked) * 100 : 0;
    const winRate = settledCount > 0 ? (won.length / settledCount) * 100 : 0;

    return {
      settledBets: settledCount,
      wonBets: won.length,
      winRate: `${winRate.toFixed(1)}%`,
      netUnits: formatSigned(netUnits, 3),
      roi: `${formatSigned(roi, 1)}%`,
    };
  }

  private sanitizeAlertDetail(body: string): string {
    const normalized = body.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 180) return normalized;
    return `${normalized.slice(0, 177)}...`;
  }

  async getCompetitionStats(userId: string): Promise<CompetitionStat[]> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [analyzedRuns, modelBets, userBets] =
      await this.repo.getCompetitionData(userId, since);

    // Compter les fixtures analysées par compétition
    const activeByComp = new Map<string, number>();
    for (const run of analyzedRuns) {
      const comp = run.fixture.season.competition;
      activeByComp.set(comp.id, (activeByComp.get(comp.id) ?? 0) + 1);
    }

    // Agréger les bets MODEL par compétition
    type CompKey = string;
    type BetAgg = {
      won: number;
      total: number;
      staked: Decimal;
      returned: Decimal;
    };
    const modelAgg = new Map<
      CompKey,
      BetAgg & { comp: { id: string; name: string; code: string } }
    >();
    for (const bet of modelBets) {
      const comp = bet.fixture.season.competition;
      const existing = modelAgg.get(comp.id) ?? {
        comp,
        won: 0,
        total: 0,
        staked: new Decimal(0),
        returned: new Decimal(0),
      };
      const stake = new Decimal(bet.stakePct.toString());
      existing.total += 1;
      existing.staked = existing.staked.plus(stake);
      if (bet.status === 'WON') {
        existing.won += 1;
        existing.returned = existing.returned.plus(
          stake.times(bet.oddsSnapshot!.toString()),
        );
      }
      modelAgg.set(comp.id, existing);
    }

    // Agréger les picks USER par compétition
    type UserAgg = {
      won: number;
      total: number;
      staked: Decimal;
      returned: Decimal;
    };
    const userAgg = new Map<CompKey, UserAgg>();
    for (const bet of userBets) {
      const compId = bet.fixture.season.competition.id;
      const existing = userAgg.get(compId) ?? {
        won: 0,
        total: 0,
        staked: new Decimal(0),
        returned: new Decimal(0),
      };
      const stake = new Decimal(bet.stakePct.toString());
      existing.total += 1;
      existing.staked = existing.staked.plus(stake);
      if (bet.status === 'WON') {
        existing.won += 1;
        existing.returned = existing.returned.plus(
          stake.times(bet.oddsSnapshot!.toString()),
        );
      }
      userAgg.set(compId, existing);
    }

    const stats: CompetitionStat[] = [];

    for (const [compId, model] of modelAgg) {
      const active = activeByComp.get(compId) ?? 0;
      const userPicks = userAgg.get(compId) ?? null;

      const modelRoi =
        model.total >= MIN_SETTLED_MODEL && model.staked.gt(0)
          ? formatSigned(
              model.returned
                .minus(model.staked)
                .dividedBy(model.staked)
                .times(100)
                .toNumber(),
              1,
            ) + '%'
          : null;

      const modelWinRate =
        model.total >= MIN_SETTLED_MODEL
          ? `${Math.round((model.won / model.total) * 100)}%`
          : null;

      const myPicksRoi =
        userPicks &&
        userPicks.total >= MIN_SETTLED_USER &&
        userPicks.staked.gt(0)
          ? formatSigned(
              userPicks.returned
                .minus(userPicks.staked)
                .dividedBy(userPicks.staked)
                .times(100)
                .toNumber(),
              1,
            ) + '%'
          : null;

      stats.push({
        competitionId: compId,
        competitionName: model.comp.name,
        competitionCode: model.comp.code,
        activeFixtures: active,
        model: {
          settled: model.total,
          won: model.won,
          roi: modelRoi,
          winRate: modelWinRate,
        },
        myPicks: userPicks
          ? { settled: userPicks.total, won: userPicks.won, roi: myPicksRoi }
          : null,
      });
    }

    // Tri : fixtures actives décroissant, puis ROI modèle
    return stats.sort((a, b) => {
      if (b.activeFixtures !== a.activeFixtures)
        return b.activeFixtures - a.activeFixtures;
      const roiA = a.model.roi ? parseFloat(a.model.roi) : -Infinity;
      const roiB = b.model.roi ? parseFloat(b.model.roi) : -Infinity;
      return roiB - roiA;
    });
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const bets = await this.repo.getLeaderboardData();

    type UserAgg = {
      username: string;
      won: number;
      total: number;
      staked: Decimal;
      returned: Decimal;
    };
    const byUser = new Map<string, UserAgg>();

    for (const bet of bets) {
      if (!bet.userId || !bet.user) continue;
      const existing = byUser.get(bet.userId) ?? {
        username: bet.user.username,
        won: 0,
        total: 0,
        staked: new Decimal(0),
        returned: new Decimal(0),
      };
      const stake = new Decimal(bet.stakePct.toString());
      existing.total += 1;
      existing.staked = existing.staked.plus(stake);
      if (bet.status === 'WON') {
        existing.won += 1;
        existing.returned = existing.returned.plus(
          stake.times(bet.oddsSnapshot!.toString()),
        );
      }
      byUser.set(bet.userId, existing);
    }

    const eligible = [...byUser.values()]
      .filter((u) => u.total >= MIN_SETTLED_USER && u.staked.gt(0))
      .map((u) => ({
        username: u.username,
        settled: u.total,
        won: u.won,
        roiValue: u.returned
          .minus(u.staked)
          .dividedBy(u.staked)
          .times(100)
          .toNumber(),
      }))
      .sort((a, b) => b.roiValue - a.roiValue)
      .slice(0, 10);

    return eligible.map((u, i) => ({
      rank: i + 1,
      username: u.username,
      roi: formatSigned(u.roiValue, 1) + '%',
      settled: u.settled,
      won: u.won,
    }));
  }
}
