import { Injectable } from '@nestjs/common';
import {
  BetStatus,
  FixtureStatus,
  Market,
  ModelRunPhase,
  Prisma,
} from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import type {
  ChannelDecisionStatus,
  StrategyChannel,
  StrategyDecision,
  StrategySelection,
} from './channel-strategy.types';
import type { SettleableSelection } from './channel-selection-settlement';
import { NEW_COACH_WINDOW_MATCHES } from './coach-continuity.constants';

export type SettleableSelectionRow = SettleableSelection & { id: string };

// A persisted selection carries its DB id so callers can link a materialised
// Bet to the exact ChannelSelection it represents (Bet.channelSelectionId).
export type PersistedChannelSelection = StrategySelection & { id: string };

export type PersistedChannelDecision = {
  id: string;
  channel: StrategyChannel;
  status: ChannelDecisionStatus;
  selections: PersistedChannelSelection[];
};

// Filters for the read API (doc §5). `market` matches decisions that selected
// on that market.
export type ChannelDecisionFilters = {
  range: { gte: Date; lte: Date };
  competition?: string;
  channel?: StrategyChannel;
  status?: ChannelDecisionStatus;
  market?: Market;
  phase?: ModelRunPhase;
};

export type ChannelSelectionReadRow = {
  id: string;
  market: Market;
  pick: string;
  probability: Prisma.Decimal;
  odds: Prisma.Decimal | null;
  impliedProbability: Prisma.Decimal | null;
  ev: Prisma.Decimal | null;
  qualityScore: Prisma.Decimal | null;
  rank: number;
  result: BetStatus | null;
};

export type ChannelDecisionReadRow = {
  id: string;
  modelRunId: string;
  phase: ModelRunPhase;
  analyzedAt: Date;
  // When THIS ChannelDecision row was written — distinct from
  // modelRun.analyzedAt (the deterministic engine's pass, shared by every
  // channel on that run). VANTAGE attaches to an already-analyzed ModelRun
  // as a later, separate pass, so its own createdAt is the only accurate
  // "decided at" for it.
  createdAt: Date;
  channel: StrategyChannel;
  status: ChannelDecisionStatus;
  reasonCode: string | null;
  reasonDetails: Prisma.JsonValue | null;
  // True when the ModelRun was flagged by the model↔market coherence gate
  // (features.calibration_alert) — the fixture is dropped from staking.
  calibrationAlert: boolean;
  fixtureId: string;
  fixtureStatus: FixtureStatus;
  scheduledAt: Date;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competitionCode: string | null;
  competitionName: string | null;
  country: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeHtScore: number | null;
  awayHtScore: number | null;
  selections: ChannelSelectionReadRow[];
};

/**
 * Persists the per-channel decisions of one ModelRun (doc §5).
 *
 * A ModelRun is immutable (doc §8.1): a re-analysis produces a NEW run, so a
 * given (modelRunId, channel) is written exactly once. This repository does a
 * plain create and relies on @@unique([modelRunId, channel]) to reject any
 * accidental double-write — it does not upsert.
 *
 * Returns the persisted decisions with their selection ids so the caller can
 * link materialised Bets to their ChannelSelection.
 */
@Injectable()
export class ChannelDecisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveRunDecisions(
    modelRunId: string,
    decisions: readonly StrategyDecision[],
  ): Promise<PersistedChannelDecision[]> {
    if (decisions.length === 0) return [];

    return this.prisma.client.$transaction(async (tx) => {
      const persisted: PersistedChannelDecision[] = [];
      for (const decision of decisions) {
        const created = await tx.channelDecision.create({
          data: {
            modelRunId,
            channel: decision.channel,
            status: decision.status,
            reasonCode: decision.reasonCode ?? null,
            reasonDetails: toJson(decision.reasonDetails),
            ...(decision.selections.length > 0
              ? {
                  selections: {
                    create: decision.selections.map(toSelectionData),
                  },
                }
              : {}),
          },
          select: {
            id: true,
            selections: { select: { id: true, rank: true } },
          },
        });

        const idByRank = new Map(
          created.selections.map((s): [number, string] => [s.rank, s.id]),
        );
        persisted.push({
          id: created.id,
          channel: decision.channel,
          status: decision.status,
          selections: decision.selections.map((sel) => {
            const id = idByRank.get(sel.rank);
            if (id === undefined) {
              throw new Error(
                `Missing persisted ChannelSelection id for ${decision.channel} rank ${sel.rank}`,
              );
            }
            return { ...sel, id };
          }),
        });
      }
      return persisted;
    });
  }

  // All selections of a fixture's ModelRuns, for analytical settlement.
  // `onlyUnsettled` restricts to rows not yet settled (early pass); the final
  // pass re-settles everything to absorb VAR-reversed early settlements.
  async findSelectionsForFixture(
    fixtureId: string,
    opts: { onlyUnsettled: boolean },
  ): Promise<SettleableSelectionRow[]> {
    return this.prisma.client.channelSelection.findMany({
      where: {
        channelDecision: { modelRun: { fixtureId } },
        ...(opts.onlyUnsettled ? { result: null } : {}),
      },
      select: {
        id: true,
        market: true,
        pick: true,
      },
    });
  }

  async applySelectionResults(
    updates: readonly { id: string; result: BetStatus }[],
  ): Promise<void> {
    if (updates.length === 0) return;
    const settledAt = new Date();
    await this.prisma.client.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.channelSelection.update({
          where: { id: update.id },
          data: { result: update.result, settledAt },
        });
      }
    });
  }

  // Catch-up scope for `settleRange`: every FINISHED fixture with a final
  // score in [from, to] that has at least one ChannelSelection to re-settle.
  async findFinishedFixturesWithSelectionsInRange(
    from: Date,
    to: Date,
  ): Promise<
    {
      id: string;
      homeScore: number | null;
      awayScore: number | null;
      homeHtScore: number | null;
      awayHtScore: number | null;
    }[]
  > {
    return this.prisma.client.fixture.findMany({
      where: {
        status: 'FINISHED',
        scheduledAt: { gte: from, lte: to },
        modelRuns: {
          some: { channelDecisions: { some: { selections: { some: {} } } } },
        },
      },
      select: {
        id: true,
        homeScore: true,
        awayScore: true,
        homeHtScore: true,
        awayHtScore: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findByDate(
    filters: ChannelDecisionFilters,
  ): Promise<ChannelDecisionReadRow[]> {
    const { range, competition, channel, status, market, phase } = filters;

    // A fixture is re-analyzed on a rolling horizon (ModelRun.phase: ADVANCE →
    // PRE_KICKOFF → LIVE), each pass writing its own ChannelDecision per
    // channel. Resolve the latest pass per (fixture, channel) in SQL
    // (DISTINCT ON, same pattern as InvestmentCalibrationRepository) instead
    // of fetching every pass and deduping in memory.
    const idRows = await this.prisma.client.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT ON (f.id, cd.channel) cd.id
      FROM channel_decision cd
      JOIN model_run mr ON mr.id = cd."modelRunId"
      JOIN fixture f ON f.id = mr."fixtureId"
      JOIN season s ON s.id = f."seasonId"
      JOIN competition comp ON comp.id = s."competitionId"
      WHERE f."scheduledAt" >= ${range.gte}
        AND f."scheduledAt" <= ${range.lte}
        ${phase ? Prisma.sql`AND mr.phase = ${phase}::"ModelRunPhase"` : Prisma.empty}
        ${competition ? Prisma.sql`AND comp.code = ${competition}` : Prisma.empty}
        ${channel ? Prisma.sql`AND cd.channel = ${channel}::"StrategyChannel"` : Prisma.empty}
        ${status ? Prisma.sql`AND cd.status = ${status}::"ChannelDecisionStatus"` : Prisma.empty}
        ${
          market
            ? Prisma.sql`AND EXISTS (
                SELECT 1 FROM channel_selection cs
                WHERE cs."channelDecisionId" = cd.id AND cs.market = ${market}::"Market"
              )`
            : Prisma.empty
        }
      ORDER BY f.id, cd.channel, mr."analyzedAt" DESC
    `;

    if (idRows.length === 0) return [];

    const rows = await this.prisma.client.channelDecision.findMany({
      where: { id: { in: idRows.map((r) => r.id) } },
      select: {
        id: true,
        modelRunId: true,
        channel: true,
        status: true,
        reasonCode: true,
        reasonDetails: true,
        createdAt: true,
        modelRun: {
          select: {
            phase: true,
            analyzedAt: true,
            features: true,
            fixture: {
              select: {
                id: true,
                status: true,
                scheduledAt: true,
                homeScore: true,
                awayScore: true,
                homeHtScore: true,
                awayHtScore: true,
                homeTeamId: true,
                awayTeamId: true,
                homeTeam: { select: { name: true, logoUrl: true } },
                awayTeam: { select: { name: true, logoUrl: true } },
                season: {
                  select: {
                    competition: {
                      select: { code: true, name: true, country: true },
                    },
                  },
                },
              },
            },
          },
        },
        selections: {
          select: {
            id: true,
            market: true,
            pick: true,
            probability: true,
            odds: true,
            impliedProbability: true,
            ev: true,
            qualityScore: true,
            rank: true,
            result: true,
          },
          orderBy: { rank: 'asc' },
        },
      },
      orderBy: [
        { modelRun: { fixture: { scheduledAt: 'asc' } } },
        { channel: 'asc' },
      ],
    });

    const mapped: ChannelDecisionReadRow[] = rows.map((row) => ({
      id: row.id,
      modelRunId: row.modelRunId,
      phase: row.modelRun.phase,
      analyzedAt: row.modelRun.analyzedAt,
      createdAt: row.createdAt,
      channel: row.channel,
      status: row.status,
      reasonCode: row.reasonCode,
      reasonDetails: row.reasonDetails,
      calibrationAlert: hasCalibrationAlert(row.modelRun.features),
      fixtureId: row.modelRun.fixture.id,
      fixtureStatus: row.modelRun.fixture.status,
      scheduledAt: row.modelRun.fixture.scheduledAt,
      homeTeamId: row.modelRun.fixture.homeTeamId,
      awayTeamId: row.modelRun.fixture.awayTeamId,
      homeTeam: row.modelRun.fixture.homeTeam.name,
      awayTeam: row.modelRun.fixture.awayTeam.name,
      homeLogo: row.modelRun.fixture.homeTeam.logoUrl,
      awayLogo: row.modelRun.fixture.awayTeam.logoUrl,
      competitionCode: row.modelRun.fixture.season.competition.code,
      competitionName: row.modelRun.fixture.season.competition.name,
      country: row.modelRun.fixture.season.competition.country,
      homeScore: row.modelRun.fixture.homeScore,
      awayScore: row.modelRun.fixture.awayScore,
      homeHtScore: row.modelRun.fixture.homeHtScore,
      awayHtScore: row.modelRun.fixture.awayHtScore,
      selections: row.selections,
    }));

    return mapped;
  }

  // Informational only (see coach-continuity.constants.ts) — teams whose
  // current coach (most recent coach_tenure with startDate <= that team's
  // own match date) has taken charge for fewer than NEW_COACH_WINDOW_MATCHES
  // finished matches. `teamAsOf` keys are teamId, one entry per team appearing
  // in the response the caller is building (a team plays at most once on any
  // given date, so this doesn't need per-fixture disambiguation).
  async findNewCoachTeams(
    teamAsOf: ReadonlyMap<string, Date>,
  ): Promise<Set<string>> {
    if (teamAsOf.size === 0) return new Set();

    const teamIds = [...teamAsOf.keys()];
    const tenures = await this.prisma.client.coachTenure.findMany({
      where: { teamId: { in: teamIds } },
      select: { teamId: true, startDate: true },
      orderBy: { startDate: 'desc' },
    });

    const startsByTeam = new Map<string, Date[]>();
    for (const tenure of tenures) {
      const starts = startsByTeam.get(tenure.teamId);
      if (starts) starts.push(tenure.startDate);
      else startsByTeam.set(tenure.teamId, [tenure.startDate]);
    }

    // startsByTeam[teamId] is sorted desc (from the query above), so the
    // first entry <= asOf is that team's current coach as of that date.
    const windowByTeam = new Map<string, { start: Date; end: Date }>();
    for (const [teamId, asOf] of teamAsOf) {
      const coachStart = startsByTeam
        .get(teamId)
        ?.find((start) => start <= asOf);
      if (coachStart)
        windowByTeam.set(teamId, { start: coachStart, end: asOf });
    }

    if (windowByTeam.size === 0) return new Set();

    const windows = [...windowByTeam.values()];
    const earliestStart = windows.reduce(
      (min, w) => (w.start < min ? w.start : min),
      windows[0].start,
    );
    const latestEnd = windows.reduce(
      (max, w) => (w.end > max ? w.end : max),
      windows[0].end,
    );

    // One bounding query for every team's window instead of a per-team
    // fixture.count — each team's actual games-played is then computed
    // in memory against its own [coachStart, asOf) range.
    const candidateFixtures = await this.prisma.client.fixture.findMany({
      where: {
        OR: [...windowByTeam.keys()].flatMap((teamId) => [
          { homeTeamId: teamId },
          { awayTeamId: teamId },
        ]),
        status: 'FINISHED',
        scheduledAt: { gte: earliestStart, lt: latestEnd },
      },
      select: { homeTeamId: true, awayTeamId: true, scheduledAt: true },
    });

    const newCoachTeams = new Set<string>();
    for (const [teamId, { start, end }] of windowByTeam) {
      const gamesPlayed = candidateFixtures.filter(
        (f) =>
          (f.homeTeamId === teamId || f.awayTeamId === teamId) &&
          f.scheduledAt >= start &&
          f.scheduledAt < end,
      ).length;
      if (gamesPlayed < NEW_COACH_WINDOW_MATCHES) {
        newCoachTeams.add(teamId);
      }
    }

    return newCoachTeams;
  }
}

// Non-null features.calibration_alert (1X2) or non-empty
// features.calibration_alert_over_under (OVER_UNDER, added 2026-08-15) =
// model↔market coherence gate triggered (see betting-engine/market-coherence.ts).
function hasCalibrationAlert(features: Prisma.JsonValue | null): boolean {
  if (!features || typeof features !== 'object' || Array.isArray(features)) {
    return false;
  }
  const record = features as Record<string, unknown>;
  const alert = record['calibration_alert'];
  const alertOverUnder = record['calibration_alert_over_under'];
  return (
    (typeof alert === 'object' && alert !== null) ||
    (Array.isArray(alertOverUnder) && alertOverUnder.length > 0)
  );
}

function toJson(
  details: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (details === undefined) return Prisma.JsonNull;
  return details as Prisma.InputJsonValue;
}

function toSelectionData(
  selection: StrategySelection,
): Prisma.ChannelSelectionCreateWithoutChannelDecisionInput {
  return {
    market: selection.market,
    pick: selection.pick,
    probability: selection.probability,
    odds: selection.odds ?? null,
    impliedProbability: selection.impliedProbability ?? null,
    ev: selection.ev ?? null,
    qualityScore: selection.qualityScore ?? null,
    rank: selection.rank,
  };
}
