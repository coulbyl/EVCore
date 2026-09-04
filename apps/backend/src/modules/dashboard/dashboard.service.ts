import { Injectable } from '@nestjs/common';
import { BetStatus, StrategyChannel } from '@evcore/db';
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
import {
  PRIMARY_METRIC_BY_CHANNEL,
  TRACKED_CHANNELS,
} from './dashboard.constants';
import { DashboardRepository } from './dashboard.repository';

// Assez long pour couvrir les appels simultanés d'un chargement de page et un
// rafraîchissement rapide ; assez court pour qu'un nouveau règlement apparaisse
// sans redémarrage.
const SETTLED_CACHE_TTL_MS = 60_000;
const SETTLED_CACHE_MAX_ENTRIES = 6;
import type {
  ChannelCompetitionStatItem,
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
// Minimum settled coupons before a user is ranked on the leaderboard at all.
// Below this, a single lucky longshot coupon (e.g. +900% ROI on one bet)
// could otherwise permanently outrank consistent, high-volume players —
// ROI on 1-4 coupons isn't a track record yet. Chosen deliberately as a
// hard eligibility floor rather than a soft ROI-shrinkage weight: with an
// unbounded metric like ROI (a single parlay can return orders of magnitude
// more than a typical coupon), no fixed shrinkage constant reliably tames
// a large enough outlier — a floor does, by construction.
const LEADERBOARD_MIN_SETTLED = 5;

// The leaderboard query was unbounded (every settled coupon ever, no LIMIT,
// full aggregation in JS) — a genuine "heavier every day" cost on a page
// loaded on every visit. A rolling window keeps it light without changing
// what it measures for an active player (whose settled history is recent
// anyway); same 90-day default already used elsewhere for this kind of
// "enough signal, still cheap" tradeoff (Decisions' calibration badge,
// Track Record's default period).
const LEADERBOARD_WINDOW_DAYS = 90;

type SummaryData = Awaited<ReturnType<DashboardRepository['getSummaryData']>>;

type UnreadNotification = SummaryData['unreadNotifications'][number];

@Injectable()
export class DashboardService {
  /**
   * Mémoïsation courte des sélections réglées, par plage de dates. Sert
   * d'abord à collapser les trois appels simultanés d'un même chargement de
   * page en une seule requête — voir settledByChannel.
   */
  private readonly settledCache = new Map<
    string,
    {
      at: number;
      rows: Promise<Map<StrategyChannel, SelectionWithCompetition[]>>;
    }
  >();

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
        value: String(data.selectedDecisionsToday),
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

    const valueBets = bets.filter(
      (b) =>
        b.channelSelection?.channelDecision.channel === StrategyChannel.VALUE,
    );
    const safeBets = bets.filter(
      (b) =>
        b.channelSelection?.channelDecision.channel === StrategyChannel.SAFE,
    );

    return {
      from,
      to,
      global: this.buildPnlSummary(bets),
      value: this.buildPnlSummary(valueBets),
      safe: this.buildPnlSummary(safeBets),
    };
  }

  async getCompetitionStats(
    canal?: 'VALUE' | 'SAFE',
  ): Promise<CompetitionStat[]> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [analyzedRuns, modelBets] = await this.repo.getCompetitionData(
      since,
      canal,
    );

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
      probSum: Decimal;
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
        probSum: new Decimal(0),
      };
      existing.total += 1;
      existing.probSum = existing.probSum.plus(
        new Decimal(bet.probEstimated.toString()),
      );
      if (bet.status === 'WON') existing.won += 1;
      modelAgg.set(comp.id, existing);
    }

    const stats: CompetitionStat[] = [];

    for (const [compId, model] of modelAgg) {
      const active = activeByComp.get(compId) ?? 0;

      const avgProbability =
        model.total > 0 ? model.probSum.dividedBy(model.total).toNumber() : 0;
      const hitRate = model.won / model.total;
      const calibrationRatio =
        model.total >= MIN_SETTLED_MODEL && avgProbability > 0
          ? hitRate / avgProbability
          : null;

      const modelWinRate =
        model.total >= MIN_SETTLED_MODEL
          ? `${Math.round(hitRate * 100)}%`
          : null;

      stats.push({
        competitionId: compId,
        competitionName: model.comp.name,
        competitionCode: model.comp.code,
        activeFixtures: active,
        model: {
          settled: model.total,
          won: model.won,
          winRate: modelWinRate,
          calibrationRatio,
          status: calibrationStatus(
            calibrationRatio,
            model.total,
            MIN_SETTLED_MODEL,
          ),
        },
      });
    }

    // Tri : fixtures actives décroissant, puis fiabilité (ratio de
    // calibration) décroissante — plus le ROI, anti-prédictif à ce volume
    // (voir CLAUDE.md et l'audit 2026-08-22). Une compétition sans donnée
    // suffisante (ratio null) est classée après celles qui en ont.
    return stats.sort((a, b) => {
      if (b.activeFixtures !== a.activeFixtures)
        return b.activeFixtures - a.activeFixtures;
      const ratioA = a.model.calibrationRatio ?? -Infinity;
      const ratioB = b.model.calibrationRatio ?? -Infinity;
      return ratioB - ratioA;
    });
  }

  /**
   * Charge une fois les sélections réglées de tous les canaux suivis, et les
   * regroupe par canal.
   *
   * La PROMESSE est mise en cache, pas son résultat : les trois endpoints de
   * la page partent en parallèle sur la même plage, donc mémoriser la valeur
   * résolue arriverait trop tard — les trois requêtes seraient déjà lancées.
   * En cachant la promesse, les deux appels suivants attendent la première.
   *
   * Les trois endpoints appelaient auparavant une requête PAR CANAL, toutes
   * lancées en parallèle. Tenable à 10 canaux, plus du tout à
   * 18 : chaque worker parallèle de Postgres réclame un segment de mémoire
   * partagée, et le conteneur n'a que les 64 Mo de `/dev/shm` par défaut. La
   * page tombait sur « could not resize shared memory segment » (SQLSTATE
   * 53100) dès la période « tout l'historique ».
   *
   * Chaque canal suivi est présent dans la carte même sans sélection sur la
   * période : un canal silencieux doit figurer à zéro, pas disparaître.
   */
  private settledByChannel(range: {
    since: Date;
    until: Date;
  }): Promise<Map<StrategyChannel, SelectionWithCompetition[]>> {
    const key = `${range.since.toISOString()}..${range.until.toISOString()}`;
    const cached = this.settledCache.get(key);
    if (cached && Date.now() - cached.at < SETTLED_CACHE_TTL_MS) {
      return cached.rows;
    }

    const rows = this.loadSettledByChannel(range);
    if (this.settledCache.size >= SETTLED_CACHE_MAX_ENTRIES) {
      const oldest = [...this.settledCache.entries()].sort(
        (a, b) => a[1].at - b[1].at,
      )[0];
      if (oldest) this.settledCache.delete(oldest[0]);
    }
    this.settledCache.set(key, { at: Date.now(), rows });
    // Un échec ne doit pas rester en cache : la prochaine requête doit
    // retenter au lieu de resservir la promesse rejetée pendant tout le TTL.
    rows.catch(() => this.settledCache.delete(key));
    return rows;
  }

  private async loadSettledByChannel(range: {
    since: Date;
    until: Date;
  }): Promise<Map<StrategyChannel, SelectionWithCompetition[]>> {
    const rows = await this.repo.findChannelSelectionsInRange(
      TRACKED_CHANNELS,
      range,
    );
    const byChannel = new Map<StrategyChannel, SelectionWithCompetition[]>(
      TRACKED_CHANNELS.map((channel) => [channel, []]),
    );
    for (const row of rows) {
      byChannel.get(row.channelDecision.channel)?.push(row);
    }
    return byChannel;
  }

  /**
   * Santé de chaque canal suivi.
   *
   * Itère sur TRACKED_CHANNELS au lieu d'énumérer les canaux : la version
   * précédente en listait 10 en dur, et les 8 canaux ouverts depuis
   * n'apparaissaient nulle part malgré leurs résultats réglés.
   *
   * Tout est lu depuis `channel_selection`, y compris VALUE et SAFE qui
   * passaient auparavant par la table `bet`. Deux raisons : `bet` n'est écrit
   * que pour ces deux canaux (persistChannelBet), donc leurs lignes n'étaient
   * pas comparables aux autres sur cette page ; et c'est la source qu'ont déjà
   * adoptée la calibration et le pool de coupon pour cette raison exacte.
   * Effet de bord bienvenu : VALUE et SAFE ont désormais un taux de réussite,
   * là où ils affichaient `null`.
   */
  async getChannelHealth(
    from: string,
    to: string,
  ): Promise<ChannelHealthItem[]> {
    const range = {
      since: startOfUtcDay(parseIsoDate(from)),
      until: endOfUtcDay(parseIsoDate(to)),
    };
    const bySelection = await this.settledByChannel(range);

    return [...bySelection].map(([channel, selections]) =>
      channelHealthFromSelections(
        channel,
        selections,
        PRIMARY_METRIC_BY_CHANNEL[channel] ?? 'HIT_RATE',
      ),
    );
  }

  async getChannelStats(from: string, to: string): Promise<ChannelStatsItem[]> {
    const range = {
      since: startOfUtcDay(parseIsoDate(from)),
      until: endOfUtcDay(parseIsoDate(to)),
    };
    const bySelection = await this.settledByChannel(range);

    return [...bySelection].map(([channel, selections]) =>
      channelStatsFromSelections(channel, selections),
    );
  }

  /** Same settled data as getChannelStats, one level finer — grouped by
   * competition per channel. Independent tracking section on the
   * track-record page (channel × competition), not a replacement for the
   * per-channel summary. */
  async getChannelStatsByCompetition(
    from: string,
    to: string,
  ): Promise<ChannelCompetitionStatItem[]> {
    const range = {
      since: startOfUtcDay(parseIsoDate(from)),
      until: endOfUtcDay(parseIsoDate(to)),
    };
    const bySelection = await this.settledByChannel(range);

    return [...bySelection].flatMap(([channel, selections]) =>
      channelCompetitionStatsFromSelections(channel, selections),
    );
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const since = new Date(Date.now() - LEADERBOARD_WINDOW_DAYS * 86_400_000);
    const betSlips = await this.repo.getLeaderboardData(since);

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
      .filter((u) => u.total >= LEADERBOARD_MIN_SETTLED && u.staked.gt(0))
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

type FlatBet = { status: string; oddsSnapshot: { toString(): string } | null };

function netUnitsFromBets(bets: FlatBet[]): number | null {
  if (!bets.length) return null;
  return bets.reduce((acc, b) => {
    const odds = b.oddsSnapshot ? parseFloat(b.oddsSnapshot.toString()) : null;
    if (odds === null) return acc;
    return acc + (b.status === 'WON' ? odds - 1 : -1);
  }, 0);
}

// bets must be in chronological order (oldest first)
function maxDrawdownFromBets(bets: FlatBet[]): number | null {
  if (!bets.length) return null;
  let peak = 0;
  let running = 0;
  let maxDD = 0;
  for (const b of bets) {
    const odds = b.oddsSnapshot ? parseFloat(b.oddsSnapshot.toString()) : null;
    if (odds === null) continue;
    running += b.status === 'WON' ? odds - 1 : -1;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

// Same floor CLAUDE.md/VANTAGE's own guardrail use for "poorly calibrated"
// (docs/vantage-centric-redesign-2026-09-01.md §4 point 3, §5.8) — ratio
// réel/annoncé below this is measured overconfident enough to distrust.
// Reused here for consistency: this page previously classified by ROI
// (§5.4 of that doc) even though DRAW was flagged "Négatif" on ROI while
// being one of only 2 channels with a genuinely positive calibration ratio
// after shrinkage (2026-08-22 audit) — the classification basis was wrong,
// not just this one channel's number.
const CALIBRATION_GOOD_RATIO = 0.85;
// A wider margin below GOOD before calling a channel outright unreliable
// rather than borderline — same asymmetric shape (a narrow middle band,
// no distinct tier above GOOD) as the ROI thresholds this replaces.
const CALIBRATION_BAD_RATIO = 0.7;

function calibrationStatus(
  ratio: number | null,
  sampleSize: number,
  minSample: number,
): ChannelStatus {
  if (sampleSize < minSample) return 'INSUFFICIENT_DATA';
  if (ratio === null) return 'INACTIVE';
  if (ratio >= CALIBRATION_GOOD_RATIO) return 'GREEN';
  if (ratio >= CALIBRATION_BAD_RATIO) return 'ORANGE';
  return 'RED';
}

// hitRate ÷ average announced probability — same formula as VANTAGE's own
// context calibration (apps/vantage-worker/src/context/build-match-
// context.ts's loadChannelCalibration) and the admission philosophy
// documented in project memory feedback_admission_par_calibration: ratio
// réel/annoncé, never ROI.
function calibrationRatioOf(selections: SettledSelection[]): number | null {
  if (selections.length === 0) return null;
  const hitRate = hitRateOf(selections);
  if (hitRate === null) return null;
  const avgProbability =
    selections.reduce((acc, s) => acc + toNumber(s.probability), 0) /
    selections.length;
  if (avgProbability <= 0) return null;
  return hitRate / avgProbability;
}

// DOMINANT/BTTS/DRAW/GOALS settle via ChannelSelection.result rather than a
// materialised Bet (see DashboardRepository.findRecentChannelSelections) —
// reshape into the {status, oddsSnapshot} FlatBet shape so the same flat-stake
// math as VALUE/SAFE applies.
type SettledSelection = {
  // Schema-nullable, but the repository query filters to WON/LOST only.
  result: BetStatus | null;
  odds: { toString(): string } | null;
  probability: { toString(): string };
};

function asFlatBets(selections: SettledSelection[]): FlatBet[] {
  return selections.map((s) => ({
    status: s.result ?? '',
    oddsSnapshot: s.odds,
  }));
}

function hitRateOf(selections: SettledSelection[]): number | null {
  if (selections.length === 0) return null;
  const won = selections.filter((s) => s.result === BetStatus.WON).length;
  return won / selections.length;
}

function channelHealthFromSelections(
  channel: ChannelHealthItem['channel'],
  selections: SettledSelection[],
  primaryMetricType: ChannelHealthItem['primaryMetricType'],
): ChannelHealthItem {
  const roi = flatBetRoi(asFlatBets(selections));
  const hitRate = hitRateOf(selections);
  const calibrationRatio = calibrationRatioOf(selections);
  return {
    channel,
    status: calibrationStatus(calibrationRatio, selections.length, 30),
    primaryMetric: (primaryMetricType === 'HIT_RATE' ? hitRate : roi) ?? 0,
    primaryMetricType,
    roi,
    hitRate,
    calibrationRatio,
    vsThreshold: null,
    sampleSize: selections.length,
  };
}

type CompetitionRef = { code: string; name: string; country: string };

type SelectionWithCompetition = SettledSelection & {
  channelDecision: {
    modelRun: { fixture: { season: { competition: CompetitionRef } } };
  };
};

function groupByCompetition<T>(
  rows: T[],
  competitionOf: (row: T) => CompetitionRef,
): Map<string, { name: string; country: string; rows: T[] }> {
  const groups = new Map<
    string,
    { name: string; country: string; rows: T[] }
  >();
  for (const row of rows) {
    const { code, name, country } = competitionOf(row);
    const entry = groups.get(code);
    if (entry) entry.rows.push(row);
    else groups.set(code, { name, country, rows: [row] });
  }
  return groups;
}
function channelCompetitionStatsFromSelections(
  channel: ChannelCompetitionStatItem['channel'],
  selections: SelectionWithCompetition[],
): ChannelCompetitionStatItem[] {
  const groups = groupByCompetition(
    selections,
    (s) => s.channelDecision.modelRun.fixture.season.competition,
  );
  return Array.from(groups.entries()).map(
    ([competitionCode, { name, country, rows }]) => {
      const roi = flatBetRoi(asFlatBets(rows));
      const calibrationRatio = calibrationRatioOf(rows);
      return {
        channel,
        competitionCode,
        competitionName: name,
        competitionCountry: country,
        roi,
        hitRate: hitRateOf(rows),
        calibrationRatio,
        sampleSize: rows.length,
        status: calibrationStatus(calibrationRatio, rows.length, 30),
      };
    },
  );
}

function channelStatsFromSelections(
  channel: ChannelStatsItem['channel'],
  selections: SettledSelection[],
): ChannelStatsItem {
  const flatBets = asFlatBets(selections);
  return {
    channel,
    hitRate: hitRateOf(selections),
    avgThreshold: null,
    vsThreshold: null,
    roi: flatBetRoi(flatBets),
    netUnits: netUnitsFromBets(flatBets),
    maxDrawdown: maxDrawdownFromBets([...flatBets].reverse()),
    sampleSize: selections.length,
    oddsAvailabilityRate: 1,
    trend: 'FLAT' as const,
  };
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
