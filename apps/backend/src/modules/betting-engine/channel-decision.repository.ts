import { Injectable } from '@nestjs/common';
import { BetStatus, Market, ModelRunPhase, Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import type {
  ChannelDecisionStatus,
  StrategyChannel,
  StrategyDecision,
  StrategySelection,
} from './channel-strategy.types';
import type { SettleableSelection } from './channel-selection-settlement';

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
  market: Market;
  pick: string;
  comboMarket: Market | null;
  comboPick: string | null;
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
  channel: StrategyChannel;
  status: ChannelDecisionStatus;
  reasonCode: string | null;
  reasonDetails: Prisma.JsonValue | null;
  // True when the ModelRun was flagged by the model↔market coherence gate
  // (features.calibration_alert) — the fixture is dropped from staking.
  calibrationAlert: boolean;
  fixtureId: string;
  scheduledAt: Date;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competitionCode: string | null;
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
        comboMarket: true,
        comboPick: true,
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

  async findByDate(
    filters: ChannelDecisionFilters,
  ): Promise<ChannelDecisionReadRow[]> {
    const { range, competition, channel, status, market, phase } = filters;
    const rows = await this.prisma.client.channelDecision.findMany({
      where: {
        modelRun: {
          ...(phase ? { phase } : {}),
          fixture: {
            scheduledAt: range,
            ...(competition
              ? { season: { competition: { code: competition } } }
              : {}),
          },
        },
        ...(channel ? { channel } : {}),
        ...(status ? { status } : {}),
        ...(market ? { selections: { some: { market } } } : {}),
      },
      select: {
        id: true,
        modelRunId: true,
        channel: true,
        status: true,
        reasonCode: true,
        reasonDetails: true,
        modelRun: {
          select: {
            phase: true,
            analyzedAt: true,
            features: true,
            fixture: {
              select: {
                id: true,
                scheduledAt: true,
                homeScore: true,
                awayScore: true,
                homeHtScore: true,
                awayHtScore: true,
                homeTeam: { select: { name: true, logoUrl: true } },
                awayTeam: { select: { name: true, logoUrl: true } },
                season: {
                  select: {
                    competition: { select: { code: true, country: true } },
                  },
                },
              },
            },
          },
        },
        selections: {
          select: {
            market: true,
            pick: true,
            comboMarket: true,
            comboPick: true,
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
      channel: row.channel,
      status: row.status,
      reasonCode: row.reasonCode,
      reasonDetails: row.reasonDetails,
      calibrationAlert: hasCalibrationAlert(row.modelRun.features),
      fixtureId: row.modelRun.fixture.id,
      scheduledAt: row.modelRun.fixture.scheduledAt,
      homeTeam: row.modelRun.fixture.homeTeam.name,
      awayTeam: row.modelRun.fixture.awayTeam.name,
      homeLogo: row.modelRun.fixture.homeTeam.logoUrl,
      awayLogo: row.modelRun.fixture.awayTeam.logoUrl,
      competitionCode: row.modelRun.fixture.season.competition.code,
      country: row.modelRun.fixture.season.competition.country,
      homeScore: row.modelRun.fixture.homeScore,
      awayScore: row.modelRun.fixture.awayScore,
      homeHtScore: row.modelRun.fixture.homeHtScore,
      awayHtScore: row.modelRun.fixture.awayHtScore,
      selections: row.selections,
    }));

    return latestPerFixtureChannel(mapped);
  }
}

// Non-null features.calibration_alert = model↔market coherence gate triggered
// (see betting-engine/market-coherence.ts).
function hasCalibrationAlert(features: Prisma.JsonValue | null): boolean {
  if (!features || typeof features !== 'object' || Array.isArray(features)) {
    return false;
  }
  const alert = (features as Record<string, unknown>)['calibration_alert'];
  return typeof alert === 'object' && alert !== null;
}

// A fixture is re-analyzed on a rolling horizon (ModelRun.phase: ADVANCE →
// PRE_KICKOFF → LIVE, cf docs/EVCORE.md §rolling horizon) — each pass writes
// its own ChannelDecision per channel (unique on [modelRunId, channel], not
// [fixtureId, channel]). The read API is fixture-centric, so without this it
// shows the same channel 2-3x per fixture (once per analysis pass) whenever
// the pick didn't change between passes. Keep only the most recent pass's
// decision per (fixture, channel).
export function latestPerFixtureChannel(
  rows: ChannelDecisionReadRow[],
): ChannelDecisionReadRow[] {
  const latest = new Map<string, ChannelDecisionReadRow>();
  for (const row of rows) {
    const key = `${row.fixtureId}:${row.channel}`;
    const existing = latest.get(key);
    if (!existing || row.analyzedAt > existing.analyzedAt) {
      latest.set(key, row);
    }
  }
  return [...latest.values()];
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
    comboMarket: selection.comboMarket ?? null,
    comboPick: selection.comboPick ?? null,
    probability: selection.probability,
    odds: selection.odds ?? null,
    impliedProbability: selection.impliedProbability ?? null,
    ev: selection.ev ?? null,
    qualityScore: selection.qualityScore ?? null,
    rank: selection.rank,
  };
}
