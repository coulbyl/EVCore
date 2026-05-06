import { Injectable } from '@nestjs/common';
import { Decision, PredictionChannel } from '@evcore/db';
import Decimal from 'decimal.js';
import { toNumber } from '@utils/prisma.utils';
import {
  startOfUtcDay,
  endOfUtcDay,
  formatTimeUtc,
  parseIsoDate,
} from '@utils/date.utils';
import { PREDICTION_CONFIG } from '@modules/prediction/prediction.constants';
import {
  signedDelta,
  formatSigned,
  buildWorkerStatus,
  notificationSeverity,
} from './dashboard.utils';
import { DashboardRepository } from './dashboard.repository';
import type {
  ChannelHealthItem,
  ChannelStatsItem,
  ChannelStatus,
  CompetitionStat,
  DashboardSummary,
  LeaderboardEntry,
  PnlByCanalResponse,
  PnlSummary,
  WorkerStatus,
} from './dashboard.types';

const MIN_SETTLED_MODEL = 10;

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

  private buildPnlSummary(
    settled: {
      status: string;
      stakePct: { toString(): string };
      oddsSnapshot: { toString(): string } | null;
    }[],
  ): PnlSummary {
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

  async getPnlByCanal(from: string, to: string): Promise<PnlByCanalResponse> {
    const since = startOfUtcDay(parseIsoDate(from));
    const until = endOfUtcDay(parseIsoDate(to));
    const bets = await this.repo.getSettledBetsForPnl({ since, until });

    const evBets = bets.filter((b) => !b.isSafeValue);
    const svBets = bets.filter((b) => b.isSafeValue);

    return {
      from,
      to,
      global: this.buildPnlSummary(bets),
      ev: this.buildPnlSummary(evBets),
      sv: this.buildPnlSummary(svBets),
    };
  }

  async getCompetitionStats(
    userId: string,
    canal?: 'EV' | 'SV',
  ): Promise<CompetitionStat[]> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [analyzedRuns, modelBets, userBets] =
      await this.repo.getCompetitionData(userId, since, canal);

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
        userPicks && userPicks.total >= 1 && userPicks.staked.gt(0)
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

  async getChannelHealth(): Promise<ChannelHealthItem[]> {
    const [evBets, svBets, confPreds, bttsePreds, drawPreds] =
      await Promise.all([
        this.repo.findRecentModelBets(false, 200),
        this.repo.findRecentModelBets(true, 200),
        this.repo.findRecentSettledPredictions(PredictionChannel.CONF, 200),
        this.repo.findRecentSettledPredictions(PredictionChannel.BTTS, 200),
        this.repo.findRecentSettledPredictions(PredictionChannel.DRAW, 200),
      ]);

    const evRoi = flatBetRoi(evBets);
    const svRoi = flatBetRoi(svBets);

    const confItems = confPreds.map(predToFlatItem);
    const confHr = hitRate(confItems);
    const confThreshold = avgThresholdForChannel(PredictionChannel.CONF);

    const bttsItems = bttsePreds.map(predToFlatItem);
    const bttsHr = hitRate(bttsItems);
    const bttsThreshold = avgThresholdForChannel(PredictionChannel.BTTS);

    const drawItems = drawPreds.map(predToFlatItem);
    const drawHr = hitRate(drawItems);
    const drawRoi = flatPredRoi(drawItems);

    return [
      {
        channel: 'EV',
        status: evRoiStatus(evRoi, evBets.length, 30),
        primaryMetric: evRoi ?? 0,
        primaryMetricType: 'ROI',
        roi: evRoi,
        hitRate: null,
        vsThreshold: null,
        sampleSize: evBets.length,
      },
      {
        channel: 'SV',
        status: evRoiStatus(svRoi, svBets.length, 30),
        primaryMetric: svRoi ?? 0,
        primaryMetricType: 'ROI',
        roi: svRoi,
        hitRate: null,
        vsThreshold: null,
        sampleSize: svBets.length,
      },
      {
        channel: 'CONF',
        status: hrStatus(confHr, confThreshold, {
          sampleSize: confItems.length,
          minSample: 30,
        }),
        primaryMetric: confHr ?? 0,
        primaryMetricType: 'HIT_RATE',
        roi: flatPredRoi(confItems),
        hitRate: confHr,
        vsThreshold:
          confHr !== null && confThreshold !== null
            ? confHr - confThreshold
            : null,
        sampleSize: confItems.length,
      },
      {
        channel: 'BTTS',
        status: hrStatus(bttsHr, bttsThreshold, {
          sampleSize: bttsItems.length,
          minSample: 30,
        }),
        primaryMetric: bttsHr ?? 0,
        primaryMetricType: 'HIT_RATE',
        roi: flatPredRoi(bttsItems),
        hitRate: bttsHr,
        vsThreshold:
          bttsHr !== null && bttsThreshold !== null
            ? bttsHr - bttsThreshold
            : null,
        sampleSize: bttsItems.length,
      },
      {
        channel: 'DRAW',
        status: drawStatus(drawRoi, drawHr, {
          sampleSize: drawItems.length,
          minSample: 20,
        }),
        primaryMetric: drawRoi ?? 0,
        primaryMetricType: 'ROI',
        roi: drawRoi,
        hitRate: drawHr,
        vsThreshold: null,
        sampleSize: drawItems.length,
      },
    ];
  }

  async getChannelStats(): Promise<ChannelStatsItem[]> {
    const health = await this.getChannelHealth();
    return health.map((item) => ({
      channel: item.channel,
      hitRate: item.hitRate,
      avgThreshold:
        item.channel === 'CONF'
          ? avgThresholdForChannel(PredictionChannel.CONF)
          : item.channel === 'BTTS'
            ? avgThresholdForChannel(PredictionChannel.BTTS)
            : null,
      vsThreshold: item.vsThreshold,
      roi: item.roi,
      netUnits: null,
      sampleSize: item.sampleSize,
      oddsAvailabilityRate: 1,
      trend: 'FLAT' as const,
    }));
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const betSlips = await this.repo.getLeaderboardData();

    type UserAgg = {
      username: string;
      won: number;
      total: number;
      staked: Decimal;
      returned: Decimal;
    };
    const byUser = new Map<string, UserAgg>();

    for (const betSlip of betSlips) {
      const existing = byUser.get(betSlip.userId) ?? {
        username: betSlip.user.username,
        won: 0,
        total: 0,
        staked: new Decimal(0),
        returned: new Decimal(0),
      };

      const { staked, returned } = computeSettledCouponReturn(betSlip);
      existing.total += 1;
      existing.staked = existing.staked.plus(staked);
      existing.returned = existing.returned.plus(returned);
      if (returned.gt(staked)) {
        existing.won += 1;
      }
      byUser.set(betSlip.userId, existing);
    }

    const eligible = [...byUser.values()]
      .filter((u) => u.total >= 1 && u.staked.gt(0))
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

type LeaderboardSlip = Awaited<
  ReturnType<DashboardRepository['getLeaderboardData']>
>[number];

// ---------------------------------------------------------------------------
// Channel-health pure helpers
// ---------------------------------------------------------------------------

type FlatItem = { correct: boolean; odds: number | null };

type OddsSnap = {
  odds?: { toString(): string } | null;
  homeOdds?: { toString(): string } | null;
  drawOdds?: { toString(): string } | null;
  awayOdds?: { toString(): string } | null;
  pick?: string | null;
};

function predToFlatItem(pred: {
  correct: boolean | null;
  pick: string;
  fixture: { oddsSnapshots: OddsSnap[] };
}): FlatItem {
  const snap = pred.fixture.oddsSnapshots[0];
  let odds: number | null = null;
  if (snap) {
    if ('odds' in snap && snap.odds != null) {
      odds = parseFloat(snap.odds.toString());
    } else if (pred.pick === 'HOME' && snap.homeOdds != null) {
      odds = parseFloat(snap.homeOdds.toString());
    } else if (pred.pick === 'DRAW' && snap.drawOdds != null) {
      odds = parseFloat(snap.drawOdds.toString());
    } else if (pred.pick === 'AWAY' && snap.awayOdds != null) {
      odds = parseFloat(snap.awayOdds.toString());
    }
  }
  return { correct: pred.correct ?? false, odds };
}

function flatPredRoi(items: FlatItem[]): number | null {
  const withOdds = items.filter((i) => i.odds !== null);
  if (!withOdds.length) return null;
  const returned = withOdds.reduce(
    (acc, i) => acc + (i.correct && i.odds !== null ? i.odds : 0),
    0,
  );
  return ((returned - withOdds.length) / withOdds.length) * 100;
}

function flatBetRoi(
  bets: { status: string; oddsSnapshot: { toString(): string } | null }[],
): number | null {
  if (!bets.length) return null;
  const returned = bets.reduce(
    (acc, b) =>
      acc +
      (b.status === 'WON' && b.oddsSnapshot
        ? parseFloat(b.oddsSnapshot.toString())
        : 0),
    0,
  );
  return ((returned - bets.length) / bets.length) * 100;
}

function hitRate(items: FlatItem[]): number | null {
  if (!items.length) return null;
  return (items.filter((i) => i.correct).length / items.length) * 100;
}

function avgThresholdForChannel(channel: PredictionChannel): number | null {
  const entries = Object.values(PREDICTION_CONFIG);
  const thresholds: number[] = [];
  for (const leagueConfig of entries) {
    const cfg = leagueConfig[channel];
    if (cfg?.enabled) thresholds.push(cfg.threshold);
  }
  if (!thresholds.length) return null;
  return (thresholds.reduce((a, b) => a + b, 0) / thresholds.length) * 100;
}

function evRoiStatus(
  roi: number | null,
  sampleSize: number,
  minSample: number,
): ChannelStatus {
  if (sampleSize < minSample) return 'INSUFFICIENT_DATA';
  if (roi === null) return 'INACTIVE';
  if (roi >= 0) return 'GREEN';
  if (roi >= -5) return 'ORANGE';
  return 'RED';
}

type SampleOpts = { sampleSize: number; minSample: number };

function hrStatus(
  hr: number | null,
  threshold: number | null,
  opts: SampleOpts,
): ChannelStatus {
  if (opts.sampleSize < opts.minSample) return 'INSUFFICIENT_DATA';
  if (hr === null || threshold === null) return 'INACTIVE';
  if (hr >= threshold) return 'GREEN';
  if (hr >= threshold - 5) return 'ORANGE';
  return 'RED';
}

function drawStatus(
  roi: number | null,
  hr: number | null,
  opts: SampleOpts,
): ChannelStatus {
  if (opts.sampleSize < opts.minSample) return 'INSUFFICIENT_DATA';
  if (roi === null) return 'INACTIVE';
  if (roi >= 5 && hr !== null && hr >= 32) return 'GREEN';
  if (roi >= 0) return 'ORANGE';
  return 'RED';
}

function computeSettledCouponReturn(betSlip: LeaderboardSlip): {
  staked: Decimal;
  returned: Decimal;
} {
  if (betSlip.type === 'COMBO') {
    const staked = new Decimal(betSlip.unitStake.toString());
    const allWon = betSlip.items.every((item) => item.bet.status === 'WON');
    if (!allWon) return { staked, returned: new Decimal(0) };

    const totalOdds = betSlip.items.reduce(
      (product, item) => product.times(item.bet.oddsSnapshot!.toString()),
      new Decimal(1),
    );
    return { staked, returned: staked.times(totalOdds) };
  }

  let staked = new Decimal(0);
  let returned = new Decimal(0);
  for (const item of betSlip.items) {
    const stake = new Decimal(
      (item.stakeOverride ?? betSlip.unitStake).toString(),
    );
    staked = staked.plus(stake);
    if (item.bet.status === 'WON') {
      returned = returned.plus(stake.times(item.bet.oddsSnapshot!.toString()));
    }
  }
  return { staked, returned };
}
