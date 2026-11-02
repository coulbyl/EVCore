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
import { BETTING_ENGINE_CONFIG_VERSION } from '@evcore/analysis-core';

export type SettleableSelectionRow = SettleableSelection & {
  id: string;
  odds: Prisma.Decimal | null;
  oddsBookmaker: string | null;
  closingOdds: Prisma.Decimal | null;
};

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
// on that market. `competition`/`channel` are multi-select (facet drawer,
// §2bis) — a checked-off subset of leagues/channels, never a single value the
// caller has to special-case.
export type ChannelDecisionFilters = {
  range: { gte: Date; lte: Date };
  competition?: string[];
  channel?: StrategyChannel[];
  status?: ChannelDecisionStatus;
  market?: Market;
  phase?: ModelRunPhase;
};

export type FacetSourceRow = {
  channel: StrategyChannel;
  code: string;
  name: string;
  country: string;
};

export type ChannelSelectionReadRow = {
  id: string;
  market: Market;
  pick: string;
  probability: Prisma.Decimal;
  odds: Prisma.Decimal | null;
  oddsBookmaker: string | null;
  marginPaid: Prisma.Decimal | null;
  marginBest: Prisma.Decimal | null;
  impliedProbability: Prisma.Decimal | null;
  ev: Prisma.Decimal | null;
  qualityScore: Prisma.Decimal | null;
  rank: number;
  result: BetStatus | null;
  settledAt: Date | null;
  closingOdds: Prisma.Decimal | null;
  closingBookmaker: string | null;
  closingLineValue: Prisma.Decimal | null;
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
            configVersion: BETTING_ENGINE_CONFIG_VERSION,
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
        odds: true,
        oddsBookmaker: true,
        closingOdds: true,
      },
    });
  }

  // Ligne de clôture et CLV d'une sélection (chantier E, E-2) — écrits une
  // fois, au règlement final, par ChannelDecisionService.
  async applySelectionClosingLines(
    updates: readonly {
      id: string;
      closingOdds: number;
      closingBookmaker: string;
      closingObservedAt: Date;
      closingLineValue: number;
    }[],
  ): Promise<void> {
    if (updates.length === 0) return;
    await this.prisma.client.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.channelSelection.update({
          where: { id: update.id },
          data: {
            closingOdds: new Prisma.Decimal(update.closingOdds),
            closingBookmaker: update.closingBookmaker,
            closingObservedAt: update.closingObservedAt,
            closingLineValue: new Prisma.Decimal(update.closingLineValue),
          },
        });
      }
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
        // Les avis VANTAGE de l'historique se règlent aussi, même quand la
        // ligne vivante a perdu sa sélection (réécrite en refus).
        OR: [
          {
            modelRuns: {
              some: {
                channelDecisions: { some: { selections: { some: {} } } },
              },
            },
          },
          { vantageDecisionHistory: { some: { market: { not: null } } } },
        ],
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
    oddsBookmaker: selection.oddsBookmaker ?? null,
    oddsSnapshotAt: selection.oddsSnapshotAt ?? null,
    marginPaid: selection.marginPaid ?? null,
    marginBest: selection.marginBest ?? null,
    impliedProbability: selection.impliedProbability ?? null,
    ev: selection.ev ?? null,
    qualityScore: selection.qualityScore ?? null,
    rank: selection.rank,
  };
}
