import { Injectable } from '@nestjs/common';
import type { BetStatus, Market, ModelRunPhase } from '@evcore/db';
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
  CHANNEL_DECISION_STATUS,
  STRATEGY_CHANNEL,
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
  country: string | null;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  kickoff: string;
  scheduledAt: string;
  score: string | null;
  htScore: string | null;
  phase: ModelRunPhase;
  channel: StrategyChannel;
  status: ChannelDecisionStatus;
  reasonCode: string | null;
  reasonDetails: unknown;
  // Model↔market coherence gate flag on the underlying ModelRun — when true
  // the whole fixture is excluded from the staking pool.
  calibrationAlert: boolean;
  selections: ChannelSelectionItem[];
};

export type ChannelDecisionMatchDecision = Pick<
  ChannelDecisionItem,
  | 'id'
  | 'modelRunId'
  | 'phase'
  | 'channel'
  | 'status'
  | 'reasonCode'
  | 'reasonDetails'
  | 'calibrationAlert'
  | 'selections'
>;

export type ChannelDecisionMatchItem = Pick<
  ChannelDecisionItem,
  | 'fixtureId'
  | 'competition'
  | 'country'
  | 'homeTeam'
  | 'awayTeam'
  | 'homeLogo'
  | 'awayLogo'
  | 'kickoff'
  | 'scheduledAt'
  | 'score'
  | 'htScore'
> & {
  selectedCount: number;
  decisions: ChannelDecisionMatchDecision[];
};

export type ChannelDecisionChannelGroup = {
  channel: StrategyChannel;
  decisions: ChannelDecisionItem[];
};

export type ChannelDecisionListQuery = {
  date: string;
  competition?: string;
  channel?: StrategyChannel;
  market?: Market;
  status?: ChannelDecisionStatus;
  phase?: ModelRunPhase;
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

  // Read API (doc §5): normalised per-channel decisions for a day, grouped by
  // match or by channel. REJECTED decisions + reasonCode are exposed.
  async listByMatch(
    query: ChannelDecisionListQuery,
  ): Promise<ChannelDecisionMatchItem[]> {
    const rows = await this.findRows(query);
    const resultMap = buildResultMap(rows);
    const groups = new Map<string, ChannelDecisionMatchItem>();

    for (const row of rows) {
      const item = enrichAvoidItem(this.toItem(row), resultMap);
      let group = groups.get(item.fixtureId);
      if (group === undefined) {
        group = {
          fixtureId: item.fixtureId,
          competition: item.competition,
          country: item.country,
          homeTeam: item.homeTeam,
          awayTeam: item.awayTeam,
          homeLogo: item.homeLogo,
          awayLogo: item.awayLogo,
          kickoff: item.kickoff,
          scheduledAt: item.scheduledAt,
          score: item.score,
          htScore: item.htScore,
          selectedCount: 0,
          decisions: [],
        };
        groups.set(item.fixtureId, group);
      }

      if (item.status === CHANNEL_DECISION_STATUS.SELECTED) {
        group.selectedCount += 1;
      }
      group.decisions.push(toMatchDecision(item));
    }

    return [...groups.values()];
  }

  async listByChannel(
    query: ChannelDecisionListQuery,
  ): Promise<ChannelDecisionChannelGroup[]> {
    const rows = await this.findRows({
      ...query,
      status: query.status ?? CHANNEL_DECISION_STATUS.SELECTED,
    });
    const resultMap = buildResultMap(rows);
    const groups = new Map<StrategyChannel, ChannelDecisionItem[]>();

    for (const row of rows) {
      const item = enrichAvoidItem(this.toItem(row), resultMap);
      const group = groups.get(item.channel) ?? [];
      group.push(item);
      groups.set(item.channel, group);
    }

    return READ_CHANNEL_ORDER.flatMap((channel) => {
      const decisions = groups.get(channel);
      return decisions === undefined ? [] : [{ channel, decisions }];
    });
  }

  private findRows(
    query: ChannelDecisionListQuery,
  ): Promise<ChannelDecisionReadRow[]> {
    const day = new Date(query.date);
    return this.repository.findByDate({
      range: { gte: startOfUtcDay(day), lte: endOfUtcDay(day) },
      competition: query.competition,
      channel: query.channel,
      status: query.status,
      market: query.market,
      phase: query.phase,
    });
  }

  private toItem(row: ChannelDecisionReadRow): ChannelDecisionItem {
    return {
      id: row.id,
      fixtureId: row.fixtureId,
      modelRunId: row.modelRunId,
      competition: row.competitionCode,
      country: row.country,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      homeLogo: row.homeLogo,
      awayLogo: row.awayLogo,
      kickoff: formatTimeUtc(row.scheduledAt),
      scheduledAt: row.scheduledAt.toISOString(),
      score: formatScoreLine(row.homeScore, row.awayScore),
      htScore: formatScoreLine(row.homeHtScore, row.awayHtScore),
      phase: row.phase,
      channel: row.channel,
      status: row.status,
      reasonCode: row.reasonCode,
      reasonDetails: row.reasonDetails,
      calibrationAlert: row.calibrationAlert,
      selections: row.selections.map(toSelectionItem),
    };
  }
}

const READ_CHANNEL_ORDER: readonly StrategyChannel[] = [
  STRATEGY_CHANNEL.VALUE,
  STRATEGY_CHANNEL.SAFE,
  STRATEGY_CHANNEL.DOMINANT,
  STRATEGY_CHANNEL.BTTS,
  STRATEGY_CHANNEL.DRAW,
  STRATEGY_CHANNEL.GOALS,
  // AVOID gates the primaries above; CONSENSUS aggregates them last.
  STRATEGY_CHANNEL.AVOID,
  STRATEGY_CHANNEL.CONSENSUS,
];

function toMatchDecision(
  item: ChannelDecisionItem,
): ChannelDecisionMatchDecision {
  return {
    id: item.id,
    modelRunId: item.modelRunId,
    phase: item.phase,
    channel: item.channel,
    status: item.status,
    reasonCode: item.reasonCode,
    reasonDetails: item.reasonDetails,
    calibrationAlert: item.calibrationAlert,
    selections: item.selections,
  };
}

// "2-1" once both sides are known, else null (matches the picks API shape).
function formatScoreLine(
  home: number | null,
  away: number | null,
): string | null {
  return home === null || away === null ? null : `${home}-${away}`;
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

// Keyed by "modelRunId:channel:market:pick" — used to enrich AVOID offenders.
function buildResultMap(
  rows: ChannelDecisionReadRow[],
): Map<string, BetStatus | null> {
  const map = new Map<string, BetStatus | null>();
  for (const row of rows) {
    for (const sel of row.selections) {
      map.set(
        `${row.modelRunId}:${row.channel}:${sel.market}:${sel.pick}`,
        sel.result,
      );
    }
  }
  return map;
}

function enrichAvoidItem(
  item: ChannelDecisionItem,
  resultMap: Map<string, BetStatus | null>,
): ChannelDecisionItem {
  if (item.channel !== STRATEGY_CHANNEL.AVOID) return item;
  const d = item.reasonDetails;
  if (!d || typeof d !== 'object') return item;
  const details = d as { offenders?: Array<Record<string, unknown>> };
  if (!Array.isArray(details.offenders)) return item;
  return {
    ...item,
    reasonDetails: {
      ...details,
      offenders: details.offenders.map((o) => ({
        ...o,
        result:
          resultMap.get(
            `${item.modelRunId}:${String(o.channel)}:${String(o.market)}:${String(o.pick)}`,
          ) ?? null,
      })),
    },
  };
}
