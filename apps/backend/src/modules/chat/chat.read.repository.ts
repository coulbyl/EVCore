import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { BetSource, FixtureStatus, Prisma, StrategyChannel } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { CacheService } from '@common/redis/cache.service';
import { extractEvaContextFromFeatures } from '@utils/model-run.utils';
import {
  probError,
  round,
  settledRoi,
  sumDecimals,
  toDecimal,
} from './chat.math';
import { CHAT_CACHE_TAGS, CHAT_CACHE_TTL } from './chat.constants';

type DateRange = {
  from?: Date;
  to?: Date;
};

type StrictDateRange = { from: Date; to: Date };

// v1 strategy channels, in display order. Channel performance is read straight
// from settled `channel_selection` rows — every channel, not just the EV/SAFE
// ones that materialise financial Bets.
const ALL_CHANNELS: StrategyChannel[] = [
  StrategyChannel.VALUE,
  StrategyChannel.SAFE,
  StrategyChannel.DOMINANT,
  StrategyChannel.BTTS,
  StrategyChannel.DRAW,
];

/** A settled outcome row surfaced by the getPredictionOutcomes tool. */
type SettledOutcome = {
  fixture: string;
  competition: string;
  date: string;
  channel: string;
  pick: string;
  probability: number;
  odds: number | null;
  result: 'WON' | 'LOST';
  probError: number;
};

/** One settled channel selection, flattened for the chat read tools. */
type SettledChannelRow = {
  channel: StrategyChannel;
  competition: string;
  match: string;
  date: Date;
  pick: string;
  probability: Prisma.Decimal;
  odds: Prisma.Decimal | null;
  ev: Prisma.Decimal | null;
  won: boolean;
};

// JSON-safe payload for the explainFixture tool — built and cached here so a
// Redis round-trip never reintroduces Date/Decimal instances.
type FixtureExplanation = {
  asOf: string | null;
  fixture: {
    id: string;
    date: string;
    status: string;
    match: string;
    competition: string;
    score: string | null;
  };
  modelRun: {
    id: string;
    finalScore: number | null;
    deterministicScore: number | null;
    mlDelta: number | null;
    scoreThreshold: number | null;
    evThreshold: number | null;
    analyzedAt: string;
  } | null;
  bets: Array<{
    id: string;
    channel: string;
    market: string;
    pick: string;
    probability: number;
    odds: number | null;
    ev: number;
    qualityScore: number | null;
    stakePct: number;
    status: string;
  }>;
  predictions: Array<{
    channel: string;
    market: string;
    pick: string;
    probability: number;
    correct: boolean | null;
  }>;
};

function isCurrentPeriod(to: Date): boolean {
  const startToday = new Date();
  startToday.setUTCHours(0, 0, 0, 0);
  return to >= startToday;
}

function rkey(method: string, args: unknown): string {
  return `chat:read:${method}:${JSON.stringify(args)}`;
}

@Injectable()
export class ChatReadRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private async cached<T>(
    key: string,
    ttl: number,
    opts: { fn: () => Promise<T>; tags?: string[] },
  ): Promise<T> {
    const hit = await this.cache.get<T>(key);
    if (hit !== null) return hit;
    const result = await opts.fn();
    const tags = opts.tags ?? [];
    if (tags.length > 0) {
      void this.cache.setWithTags(key, result, { ttl, tags });
    } else {
      void this.cache.set(key, result, ttl);
    }
    return result;
  }

  async searchFixtures(input: {
    query: string;
    range: DateRange;
    status?: FixtureStatus;
    limit: number;
  }): Promise<
    Array<{
      id: string;
      date: string;
      status: string;
      match: string;
      competition: string;
      country: string;
      score: string | null;
    }>
  > {
    return this.cached(
      rkey('searchFixtures', input),
      CHAT_CACHE_TTL.searchFixtures,
      { fn: () => this._searchFixtures(input) },
    );
  }

  private async _searchFixtures(input: {
    query: string;
    range: DateRange;
    status?: FixtureStatus;
    limit: number;
  }) {
    const q = input.query;
    const fixtures = await this.prisma.client.fixture.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
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
    return fixtures.map((fixture) => ({
      id: fixture.id,
      date: fixture.scheduledAt.toISOString(),
      status: fixture.status,
      match: `${fixture.homeTeam.name} - ${fixture.awayTeam.name}`,
      competition: fixture.season.competition.code,
      country: fixture.season.competition.country,
      score:
        fixture.homeScore === null || fixture.awayScore === null
          ? null
          : `${fixture.homeScore}-${fixture.awayScore}`,
    }));
  }

  async getFixtureExplanation(
    fixtureId: string,
  ): Promise<FixtureExplanation | null> {
    return this.cached(
      rkey('explainFixture', { fixtureId }),
      CHAT_CACHE_TTL.explainFixture,
      {
        fn: () => this._getFixtureExplanation(fixtureId),
        tags: [CHAT_CACHE_TAGS.settlement],
      },
    );
  }

  private async _getFixtureExplanation(
    fixtureId: string,
  ): Promise<FixtureExplanation | null> {
    const fixture = await this.prisma.client.fixture.findUnique({
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
            finalScore: true,
            deterministicScore: true,
            mlDelta: true,
            scoreThreshold: true,
            evThreshold: true,
            features: true,
            analyzedAt: true,
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
                channelSelection: {
                  select: { channelDecision: { select: { channel: true } } },
                },
              },
            },
          },
        },
        oddsSnapshots: {
          orderBy: { snapshotAt: 'desc' },
          take: 1,
          select: { snapshotAt: true },
        },
      },
    });
    if (!fixture) return null;
    const run = fixture.modelRuns[0] ?? null;

    return {
      asOf: fixture.oddsSnapshots[0]?.snapshotAt.toISOString() ?? null,
      fixture: {
        id: fixture.id,
        date: fixture.scheduledAt.toISOString(),
        status: fixture.status,
        match: `${fixture.homeTeam.name} - ${fixture.awayTeam.name}`,
        competition: fixture.season.competition.code,
        score:
          fixture.homeScore === null || fixture.awayScore === null
            ? null
            : `${fixture.homeScore}-${fixture.awayScore}`,
      },
      modelRun: run
        ? {
            id: run.id,
            finalScore: run.finalScore ? round(run.finalScore) : null,
            deterministicScore: run.deterministicScore
              ? round(run.deterministicScore)
              : null,
            mlDelta: run.mlDelta ? round(run.mlDelta) : null,
            scoreThreshold: run.scoreThreshold
              ? round(run.scoreThreshold)
              : null,
            evThreshold: run.evThreshold ? round(run.evThreshold) : null,
            analyzedAt: run.analyzedAt.toISOString(),
          }
        : null,
      bets:
        run?.bets.map((bet) => ({
          id: bet.id,
          channel: bet.channelSelection
            ? bet.channelSelection.channelDecision.channel
            : StrategyChannel.VALUE,
          market: bet.market,
          pick: bet.pick,
          probability: round(bet.probEstimated),
          odds: bet.oddsSnapshot ? round(bet.oddsSnapshot) : null,
          ev: round(bet.ev),
          qualityScore: bet.qualityScore ? round(bet.qualityScore) : null,
          stakePct: round(bet.stakePct),
          status: bet.status,
        })) ?? [],
      predictions: [],
    };
  }

  // ── Group B ──────────────────────────────────────────────────────────────

  async getChannelPerfStats(input: {
    range: StrictDateRange;
    channel?: StrategyChannel;
  }): Promise<
    Array<{
      channel: string;
      roi: number | null;
      hitRate: number | null;
      netUnits: number | null;
      sampleSize: number;
    }>
  > {
    const key = rkey('channelPerf', input);
    const ttl = isCurrentPeriod(input.range.to)
      ? CHAT_CACHE_TTL.channelPerfLive
      : CHAT_CACHE_TTL.channelPerfHistorical;
    return this.cached(key, ttl, {
      fn: () => this._getChannelPerfStats(input),
      tags: [CHAT_CACHE_TAGS.settlement],
    });
  }

  private async _getChannelPerfStats(input: {
    range: StrictDateRange;
    channel?: StrategyChannel;
  }) {
    const rows = await this.settledChannelRows({
      range: input.range,
      channel: input.channel,
    });
    const byChannel = groupBy(rows, (r) => r.channel);
    const channels = input.channel ? [input.channel] : ALL_CHANNELS;

    return channels.map((ch) => {
      // Flat-stake metrics over priced selections (every channel attaches its
      // own odds — DRAW via implied probability, DOMINANT/BTTS via the market).
      const priced = (byChannel.get(ch) ?? []).filter((r) => r.odds !== null);
      if (priced.length === 0) {
        return {
          channel: ch,
          roi: null,
          hitRate: null,
          netUnits: null,
          sampleSize: 0,
        };
      }
      const won = priced.filter((r) => r.won);
      const totalOdds = sumDecimals(won.map((r) => r.odds));
      return {
        channel: ch,
        roi: settledRoi(totalOdds, priced.length),
        hitRate: round(new Decimal(won.length).div(priced.length)),
        netUnits: round(totalOdds.minus(priced.length)),
        sampleSize: priced.length,
      };
    });
  }

  /**
   * Settled `channel_selection` rows in a window, optionally filtered to one
   * channel / competition. The single source the chat performance tools read —
   * covers all five channels, including the prediction-only ones that never
   * create a financial Bet.
   */
  private async settledChannelRows(input: {
    range: StrictDateRange;
    channel?: StrategyChannel;
    competitionCode?: string;
  }): Promise<SettledChannelRow[]> {
    const selections = await this.prisma.client.channelSelection.findMany({
      where: {
        result: { in: ['WON', 'LOST'] },
        channelDecision: {
          is: {
            ...(input.channel ? { channel: input.channel } : {}),
            modelRun: {
              is: {
                fixture: {
                  is: {
                    scheduledAt: {
                      gte: input.range.from,
                      lte: input.range.to,
                    },
                    ...(input.competitionCode
                      ? {
                          season: {
                            competition: { code: input.competitionCode },
                          },
                        }
                      : {}),
                  },
                },
              },
            },
          },
        },
      },
      select: {
        pick: true,
        probability: true,
        odds: true,
        ev: true,
        result: true,
        channelDecision: {
          select: {
            channel: true,
            modelRun: {
              select: {
                fixture: {
                  select: {
                    scheduledAt: true,
                    homeTeam: { select: { name: true } },
                    awayTeam: { select: { name: true } },
                    season: {
                      select: { competition: { select: { code: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return selections.map((s) => {
      const fixture = s.channelDecision.modelRun.fixture;
      return {
        channel: s.channelDecision.channel,
        competition: fixture.season.competition.code,
        match: `${fixture.homeTeam.name} - ${fixture.awayTeam.name}`,
        date: fixture.scheduledAt,
        pick: s.pick,
        probability: s.probability,
        odds: s.odds,
        ev: s.ev,
        won: s.result === 'WON',
      };
    });
  }

  async getLeagueStats(input: {
    channel: StrategyChannel;
    range: StrictDateRange;
  }): Promise<
    Array<{
      competition: string;
      hitRate: number | null;
      roi: number | null;
      picks: number;
    }>
  > {
    const key = rkey('leagueStats', input);
    const ttl = isCurrentPeriod(input.range.to)
      ? CHAT_CACHE_TTL.leagueStatsLive
      : CHAT_CACHE_TTL.leagueStatsHistorical;
    return this.cached(key, ttl, {
      fn: () => this._getLeagueStats(input),
      tags: [CHAT_CACHE_TAGS.settlement],
    });
  }

  private async _getLeagueStats(input: {
    channel: StrategyChannel;
    range: StrictDateRange;
  }) {
    const rows = await this.settledChannelRows({
      range: input.range,
      channel: input.channel,
    });
    const priced = rows.filter((r) => r.odds !== null);
    const byComp = groupBy(priced, (r) => r.competition);

    return [...byComp.entries()]
      .map(([comp, group]) => {
        const won = group.filter((r) => r.won);
        return {
          competition: comp,
          hitRate: round(new Decimal(won.length).div(group.length)),
          roi: settledRoi(sumDecimals(won.map((r) => r.odds)), group.length),
          picks: group.length,
        };
      })
      .sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0));
  }

  async getSettledOutcomes(input: {
    range: StrictDateRange;
    channel?: StrategyChannel;
    onlyMisses: boolean;
    limit: number;
  }): Promise<SettledOutcome[]> {
    const key = rkey('settledOutcomes', input);
    const ttl = isCurrentPeriod(input.range.to)
      ? CHAT_CACHE_TTL.settledOutcomesLive
      : CHAT_CACHE_TTL.settledOutcomesHistorical;
    return this.cached(key, ttl, {
      fn: () => this._getSettledOutcomes(input),
      tags: [CHAT_CACHE_TAGS.settlement],
    });
  }

  private async _getSettledOutcomes(input: {
    range: StrictDateRange;
    channel?: StrategyChannel;
    onlyMisses: boolean;
    limit: number;
  }) {
    const selections = await this.settledChannelRows({
      range: input.range,
      channel: input.channel,
    });
    const rows = selections.map(
      (s): SettledOutcome => ({
        fixture: s.match,
        competition: s.competition,
        date: s.date.toISOString().slice(0, 10),
        channel: s.channel,
        pick: s.pick,
        probability: round(s.probability),
        odds: s.odds !== null ? round(s.odds) : null,
        result: s.won ? 'WON' : 'LOST',
        probError: probError(s.probability, s.won),
      }),
    );

    rows.sort((a, b) =>
      input.onlyMisses
        ? b.probError - a.probError
        : b.date.localeCompare(a.date),
    );
    return rows.slice(0, input.limit);
  }

  // ── Group C ──────────────────────────────────────────────────────────────

  async getEdgeStats(input: { range: StrictDateRange }): Promise<
    Array<{
      segment: string;
      picks: number;
      avgEdge: number | null;
      roi: number | null;
    }>
  > {
    const key = rkey('edgeStats', input);
    const ttl =
      input.range.to && isCurrentPeriod(input.range.to)
        ? CHAT_CACHE_TTL.edgeStatsLive
        : CHAT_CACHE_TTL.edgeStatsHistorical;
    return this.cached(key, ttl, {
      fn: () => this._getEdgeStats(input),
      tags: [CHAT_CACHE_TAGS.settlement],
    });
  }

  private async _getEdgeStats(input: { range: StrictDateRange }) {
    const rows = (await this.settledChannelRows({ range: input.range })).filter(
      (r) => r.odds !== null,
    );

    type Seg = {
      edgeSum: Decimal;
      edgeCount: number;
      wonOdds: Decimal;
      total: number;
    };
    const bySegment = new Map<string, Seg>();
    for (const r of rows) {
      // Corrupt snapshot guard: a null/0 odds would make the implied
      // probability (1/odds) explode (rows are pre-filtered to priced ones).
      if (r.odds === null) continue;
      const odds = toDecimal(r.odds);
      if (odds.lte(0)) continue;
      const seg = r.channel;
      const existing = bySegment.get(seg) ?? {
        edgeSum: new Decimal(0),
        edgeCount: 0,
        wonOdds: new Decimal(0),
        total: 0,
      };
      const edge = toDecimal(r.probability).minus(new Decimal(1).div(odds));
      existing.edgeSum = existing.edgeSum.plus(edge);
      existing.edgeCount += 1;
      existing.total += 1;
      if (r.won) existing.wonOdds = existing.wonOdds.plus(odds);
      bySegment.set(seg, existing);
    }

    return [...bySegment.entries()].map(([seg, data]) => ({
      segment: seg,
      picks: data.total,
      avgEdge:
        data.edgeCount > 0 ? round(data.edgeSum.div(data.edgeCount)) : null,
      roi: settledRoi(data.wonOdds, data.total),
    }));
  }

  // ── Group D ──────────────────────────────────────────────────────────────

  async getEngineHealthData(): Promise<{
    lastFixtureSyncAt: string | null;
    lastOddsSnapshotAt: string | null;
    fixturesTodayWithoutOdds: number;
    suspendedMarkets: string[];
  }> {
    return this.cached('chat:read:engineHealth', CHAT_CACHE_TTL.engineHealth, {
      fn: () => this._getEngineHealthData(),
      tags: [CHAT_CACHE_TAGS.engineHealth],
    });
  }

  private async _getEngineHealthData() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);

    const [lastFixture, lastOdds, upcomingWithoutOdds, suspensions] =
      await Promise.all([
        this.prisma.client.fixture.findFirst({
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true },
        }),
        this.prisma.client.oddsSnapshot.findFirst({
          orderBy: { snapshotAt: 'desc' },
          select: { snapshotAt: true },
        }),
        this.prisma.client.fixture.count({
          where: {
            status: 'SCHEDULED',
            scheduledAt: { gte: today, lt: tomorrow },
            oddsSnapshots: { none: {} },
          },
        }),
        this.prisma.client.marketSuspension.findMany({
          where: { active: true },
          select: { market: true },
        }),
      ]);

    return {
      lastFixtureSyncAt: lastFixture?.updatedAt.toISOString() ?? null,
      lastOddsSnapshotAt: lastOdds?.snapshotAt.toISOString() ?? null,
      fixturesTodayWithoutOdds: upcomingWithoutOdds,
      suspendedMarkets: suspensions.map((s) => s.market),
    };
  }

  // ── Group E ──────────────────────────────────────────────────────────────

  async getUserBetStats(input: {
    userId: string;
    range: StrictDateRange;
  }): Promise<{
    picks: number;
    won: number;
    lost: number;
    pending: number;
    hitRate: number | null;
    roi: number | null;
  }> {
    // userId is part of the key — no cross-user cache leaks
    return this.cached(
      rkey('userBetStats', input),
      CHAT_CACHE_TTL.userBetStats,
      {
        fn: () => this._getUserBetStats(input),
      },
    );
  }

  private async _getUserBetStats(input: {
    userId: string;
    range: StrictDateRange;
  }) {
    const bets = await this.prisma.client.bet.findMany({
      where: {
        userId: input.userId,
        source: BetSource.USER,
        fixture: {
          scheduledAt: { gte: input.range.from, lte: input.range.to },
        },
      },
      select: { status: true, oddsSnapshot: true },
    });

    const won = bets.filter((b) => b.status === 'WON');
    const lost = bets.filter((b) => b.status === 'LOST');
    const settled = won.length + lost.length;
    const totalOdds = sumDecimals(won.map((b) => b.oddsSnapshot));

    return {
      picks: bets.length,
      won: won.length,
      lost: lost.length,
      pending: bets.length - settled,
      hitRate: settled > 0 ? round(new Decimal(won.length).div(settled)) : null,
      roi: settledRoi(totalOdds, settled),
    };
  }

  // ── Group C — ML ─────────────────────────────────────────────────────────

  async getMlModelVersions(input: {
    segment?: string;
    activeOnly: boolean;
  }): Promise<
    Array<{
      id: string;
      segment: string;
      algorithm: string;
      metrics: unknown;
      isActive: boolean;
      activatedAt: string | null;
      createdAt: string;
      notes: string | null;
    }>
  > {
    return this.cached(
      rkey('mlModelVersions', input),
      CHAT_CACHE_TTL.mlModelVersions,
      {
        fn: () => this._getMlModelVersions(input),
        tags: [CHAT_CACHE_TAGS.mlModel],
      },
    );
  }

  private async _getMlModelVersions(input: {
    segment?: string;
    activeOnly: boolean;
  }) {
    const models = await this.prisma.client.mlModelVersion.findMany({
      where: {
        ...(input.activeOnly ? { isActive: true } : {}),
        ...(input.segment ? { segment: input.segment } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        segment: true,
        algorithm: true,
        metrics: true,
        isActive: true,
        activatedAt: true,
        createdAt: true,
        notes: true,
      },
    });
    // ISO strings, not Dates: a cache hit goes through JSON and would
    // otherwise hand strings to callers expecting Date instances.
    return models.map((m) => ({
      id: m.id,
      segment: m.segment,
      algorithm: m.algorithm,
      metrics: m.metrics as unknown,
      isActive: m.isActive,
      activatedAt: m.activatedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      notes: m.notes,
    }));
  }

  // ── Group F — EVA evaluation context ─────────────────────────────────────

  async getPicksWithEvaluation(input: {
    date: string;
    limit: number;
    maxPicksPerFixture: number;
  }): Promise<PicksWithEvaluationResult> {
    const key = rkey('picksWithEvaluation', input);
    const ttl = CHAT_CACHE_TTL.picksWithEvaluation;
    return this.cached(key, ttl, {
      fn: () => this._getPicksWithEvaluation(input),
      tags: [CHAT_CACHE_TAGS.settlement, CHAT_CACHE_TAGS.engineHealth],
    });
  }

  private async _getPicksWithEvaluation(input: {
    date: string;
    limit: number;
    maxPicksPerFixture: number;
  }): Promise<PicksWithEvaluationResult> {
    const start = new Date(`${input.date}T00:00:00.000Z`);
    const end = new Date(`${input.date}T23:59:59.999Z`);

    const fixtures = await this.prisma.client.fixture.findMany({
      where: {
        scheduledAt: { gte: start, lte: end },
        status: {
          in: [
            FixtureStatus.SCHEDULED,
            FixtureStatus.IN_PROGRESS,
            FixtureStatus.FINISHED,
          ],
        },
      },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        season: { select: { competition: { select: { code: true } } } },
        modelRuns: {
          orderBy: { analyzedAt: 'desc' },
          take: 1,
          select: {
            features: true,
            bets: {
              where: { source: BetSource.MODEL, userId: null },
              select: {
                market: true,
                pick: true,
                channelSelection: {
                  select: { channelDecision: { select: { channel: true } } },
                },
              },
            },
          },
        },
      },
    });

    const withRun = fixtures.filter((f) => f.modelRuns.length > 0);
    const noModelRunCount = fixtures.length - withRun.length;

    const all = withRun.map((f) =>
      buildFixtureEvaContext(f, input.maxPicksPerFixture),
    );

    // NO_EVALUATION fixtures carry no analytical signal for EVA — count them but
    // exclude from the context to stay within LLM token budget.
    const noEvaluationCount = all.filter(
      (c) => c.analysisState === 'NO_EVALUATION',
    ).length;
    const analytical = all.filter((c) => c.analysisState !== 'NO_EVALUATION');

    analytical.sort((a, b) => {
      const stateOrder = (s: string) => (s === 'BET' ? 0 : 1);
      return (
        stateOrder(a.analysisState) - stateOrder(b.analysisState) ||
        new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
      );
    });

    return {
      date: input.date,
      asOf: new Date().toISOString(),
      noModelRunCount,
      noEvaluationCount,
      fixtures: analytical.slice(0, input.limit),
    };
  }

  async findChannelLeagueHitRate(input: {
    channel: StrategyChannel;
    competitionCode: string;
    since: Date;
  }): Promise<number | null> {
    const rows = await this.settledChannelRows({
      range: { from: input.since, to: new Date() },
      channel: input.channel,
      competitionCode: input.competitionCode,
    });
    if (rows.length === 0) return null;
    const won = rows.filter((r) => r.won).length;
    return won / rows.length;
  }
}

// ── EVA evaluation context types & builder ───────────────────────────────────

type EvaPickEntry = {
  channel: string;
  market: string;
  pick: string;
  probability: number | null;
  odds: number | null;
  ev: number | null;
  decision: 'BET' | 'NO_BET';
  rejectionReason: string | null;
};

type EvaFixtureContext = {
  fixtureId: string;
  match: string;
  kickoff: string;
  competition: string;
  status: string;
  analysisState: 'BET' | 'NO_BET' | 'NO_EVALUATION';
  analysisContext: {
    predictionSource: string | null;
    fallbackReason: string | null;
    dataQuality?: {
      marketOdds: boolean | null;
      pinnacle: boolean | null;
      eloHome: boolean | null;
      eloAway: boolean | null;
    };
  };
  lambda: { home: number; away: number; total: number } | null;
  shadowSignals?: {
    lineMovement: number | null;
    h2h: number | null;
    congestion: number | null;
  };
  evaluatedPicks: EvaPickEntry[];
};

export type PicksWithEvaluationResult = {
  date: string;
  asOf: string;
  noModelRunCount: number;
  noEvaluationCount: number;
  fixtures: EvaFixtureContext[];
};

type FixtureWithRun = {
  id: string;
  scheduledAt: Date;
  status: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  season: { competition: { code: string } };
  modelRuns: Array<{
    features: unknown;
    bets: Array<{
      market: string;
      pick: string;
      channelSelection: {
        channelDecision: { channel: StrategyChannel };
      } | null;
    }>;
  }>;
};

function buildFixtureEvaContext(
  fixture: FixtureWithRun,
  maxPicks: number,
): EvaFixtureContext {
  const run = fixture.modelRuns[0];
  const ctx = extractEvaContextFromFeatures(run.features);

  const betKeys = new Set(
    run.bets
      .filter(
        (b) =>
          b.channelSelection?.channelDecision.channel === StrategyChannel.VALUE,
      )
      .map((b) => `${b.market}|${b.pick}`),
  );
  const svKeys = new Set(
    run.bets
      .filter(
        (b) =>
          b.channelSelection?.channelDecision.channel === StrategyChannel.SAFE,
      )
      .map((b) => `${b.market}|${b.pick}`),
  );

  const picks: EvaPickEntry[] = [];
  const seen = new Set<string>();

  const addPick = (entry: EvaPickEntry) => {
    const key = `${entry.channel}|${entry.market}|${entry.pick}|${entry.probability}|${entry.odds}|${entry.ev}`;
    if (seen.has(key)) return;
    seen.add(key);
    picks.push(entry);
  };

  for (const ep of ctx.evaluatedPicks) {
    const pairKey = `${ep.market}|${ep.pick}`;
    const isSv = svKeys.has(pairKey);
    const isEv = betKeys.has(pairKey);
    const channel = isSv ? StrategyChannel.SAFE : StrategyChannel.VALUE;
    // decision=BET only when an actual bet record exists — a 'viable' status in
    // features means the pick passed EV screening, but it may not have been
    // selected as the final bet (e.g. superseded by a better pick, market issue).
    const isAccepted = isSv || isEv;
    const decision = isAccepted ? 'BET' : 'NO_BET';
    const rejectionReason =
      ep.rejectionReason ??
      (ep.status === 'viable' && !isAccepted ? 'not_selected' : null);
    addPick({
      channel,
      market: ep.market,
      pick: ep.pick,
      probability: round(ep.probability),
      odds: round(ep.odds),
      ev: round(ep.ev),
      decision,
      rejectionReason,
    });
  }

  // analysisState is derived from the full picks array across ALL channels
  // currently represented in features/bets.
  const hasAcceptedPick = picks.some((p) => p.decision === 'BET');
  const hasEvaluatedEvPicks = ctx.evaluatedPicks.length > 0;
  const analysisState: EvaFixtureContext['analysisState'] = hasAcceptedPick
    ? 'BET'
    : hasEvaluatedEvPicks
      ? 'NO_BET'
      : 'NO_EVALUATION';

  const lh = ctx.lambdaHome;
  const la = ctx.lambdaAway;

  // Trim picks to budget: keep all BET picks, then fill with top rejected
  // picks sorted by EV descending (closest to threshold = most informative).
  const betPicks = picks.filter((p) => p.decision === 'BET');
  const rejectedPicks = picks
    .filter((p) => p.decision === 'NO_BET')
    .sort((a, b) => (b.ev ?? -Infinity) - (a.ev ?? -Infinity));
  const trimmedPicks = [
    ...betPicks,
    ...rejectedPicks.slice(0, Math.max(0, maxPicks - betPicks.length)),
  ];

  // Omit sub-objects that are entirely null — saves tokens for POISSON_MAIN runs.
  const dataQuality = {
    marketOdds: ctx.hasMarketOdds,
    pinnacle: ctx.hasPinnacleOdds,
    eloHome: ctx.hasHomeElo,
    eloAway: ctx.hasAwayElo,
  };
  const hasDataQuality = Object.values(dataQuality).some((v) => v !== null);

  const shadowSignals = {
    lineMovement: ctx.shadowLineMovement,
    h2h: ctx.shadowH2h,
    congestion: ctx.shadowCongestion,
  };
  const hasShadowSignals = Object.values(shadowSignals).some((v) => v !== null);

  return {
    fixtureId: fixture.id,
    match: `${fixture.homeTeam.name} - ${fixture.awayTeam.name}`,
    kickoff: fixture.scheduledAt.toISOString(),
    competition: fixture.season.competition.code,
    status: fixture.status,
    analysisState,
    analysisContext: {
      predictionSource: ctx.predictionSource,
      fallbackReason: ctx.fallbackReason,
      ...(hasDataQuality ? { dataQuality } : {}),
    },
    lambda:
      lh !== null && la !== null
        ? { home: round(lh), away: round(la), total: round(lh + la) }
        : null,
    ...(hasShadowSignals ? { shadowSignals } : {}),
    evaluatedPicks: trimmedPicks,
  };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}
