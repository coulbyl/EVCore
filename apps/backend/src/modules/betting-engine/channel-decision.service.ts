import { Injectable } from '@nestjs/common';
import type { BetStatus, Market } from '@evcore/db';
import { startOfUtcDay, endOfUtcDay, formatTimeUtc } from '@utils/date.utils';
import {
  ChannelDecisionRepository,
  type ChannelDecisionReadRow,
  type ChannelSelectionReadRow,
  type PersistedChannelDecision,
} from './channel-decision.repository';
import { ChannelStrategyOrchestrator } from './strategies/channel-strategy.orchestrator';
import { createChannelStrategyOrchestrator } from './strategies/registry';
import type {
  ChannelDecisionStatus,
  StrategyChannel,
  StrategyContext,
} from './channel-strategy.types';
import {
  resolveSelectionEarlyResult,
  resolveSelectionFinalResult,
  type FixtureScores,
} from './channel-selection-settlement';

export type ChannelSelectionItem = {
  market: Market;
  pick: string;
  comboMarket: Market | null;
  comboPick: string | null;
  probability: number;
  odds: number | null;
  impliedProbability: number | null;
  ev: number | null;
  qualityScore: number | null;
  rank: number;
  result: BetStatus | null;
};

// Normalised read shape (doc §5): one object per run × channel, REJECTED decisions
// included with their reasonCode, SELECTED ones carrying their selections.
export type ChannelDecisionItem = {
  id: string;
  fixtureId: string;
  modelRunId: string;
  competition: string | null;
  fixture: string;
  kickoff: string;
  channel: StrategyChannel;
  status: ChannelDecisionStatus;
  reasonCode: string | null;
  selections: ChannelSelectionItem[];
};

export type ChannelDecisionListQuery = {
  date: string;
  competition?: string;
  channel?: StrategyChannel;
  market?: Market;
  status?: ChannelDecisionStatus;
};

/**
 * Bridges the betting engine to the channel-strategy layer (doc §5): runs every
 * registered strategy over one immutable ModelRun's context and persists the
 * resulting per-channel decisions. Purely analytical — financial authority
 * stays with Bet.status.
 */
@Injectable()
export class ChannelDecisionService {
  private readonly orchestrator: ChannelStrategyOrchestrator;

  constructor(private readonly repository: ChannelDecisionRepository) {
    this.orchestrator = createChannelStrategyOrchestrator();
  }

  async recordRunDecisions(
    modelRunId: string,
    context: StrategyContext,
  ): Promise<PersistedChannelDecision[]> {
    const decisions = this.orchestrator.evaluate(context);
    return this.repository.saveRunDecisions(modelRunId, decisions);
  }

  /**
   * Writes `ChannelSelection.result` for one fixture (doc §5). Analytical only —
   * Bet.status remains the financial authority. `early` settles only irrevocable
   * outcomes from the in-progress score; `final` re-settles everything from the
   * definitive score. Idempotent: a re-run yields the same result, so a selection
   * linked to a Bet is never double-counted on the financial side.
   */
  async settleFixtureSelections(opts: {
    fixtureId: string;
    scores: FixtureScores;
    mode: 'early' | 'final';
  }): Promise<{ settled: number }> {
    const { fixtureId, scores, mode } = opts;
    const selections = await this.repository.findSelectionsForFixture(
      fixtureId,
      { onlyUnsettled: mode === 'early' },
    );

    const updates: { id: string; result: BetStatus }[] = [];
    for (const selection of selections) {
      const result =
        mode === 'early'
          ? resolveSelectionEarlyResult(selection, scores)
          : resolveSelectionFinalResult(selection, scores);
      if (result === null) continue;
      updates.push({ id: selection.id, result });
    }

    await this.repository.applySelectionResults(updates);
    return { settled: updates.length };
  }

  // Read API (doc §5): normalised per-channel decisions for a day, with optional
  // strategy / market / status filters. Exposes REJECTED decisions + reasonCode.
  async list(query: ChannelDecisionListQuery): Promise<ChannelDecisionItem[]> {
    const day = new Date(query.date);
    const rows = await this.repository.findByDate({
      range: { gte: startOfUtcDay(day), lte: endOfUtcDay(day) },
      competition: query.competition,
      channel: query.channel,
      status: query.status,
      market: query.market,
    });
    return rows.map((row) => this.toItem(row));
  }

  private toItem(row: ChannelDecisionReadRow): ChannelDecisionItem {
    return {
      id: row.id,
      fixtureId: row.fixtureId,
      modelRunId: row.modelRunId,
      competition: row.competitionCode,
      fixture: `${row.homeTeam} vs ${row.awayTeam}`,
      kickoff: formatTimeUtc(row.scheduledAt),
      channel: row.channel,
      status: row.status,
      reasonCode: row.reasonCode,
      selections: row.selections.map(toSelectionItem),
    };
  }
}

function toSelectionItem(
  selection: ChannelSelectionReadRow,
): ChannelSelectionItem {
  const toNumber = (value: { toString(): string } | null): number | null =>
    value === null ? null : Number(value);
  return {
    market: selection.market,
    pick: selection.pick,
    comboMarket: selection.comboMarket,
    comboPick: selection.comboPick,
    probability: Number(selection.probability),
    odds: toNumber(selection.odds),
    impliedProbability: toNumber(selection.impliedProbability),
    ev: toNumber(selection.ev),
    qualityScore: toNumber(selection.qualityScore),
    rank: selection.rank,
    result: selection.result,
  };
}
