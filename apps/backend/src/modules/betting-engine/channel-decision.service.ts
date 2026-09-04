import { Injectable } from '@nestjs/common';
import type {
  BetStatus,
  FixtureStatus,
  Market,
  ModelRunPhase,
} from '@evcore/db';
import { startOfUtcDay, endOfUtcDay, formatTimeUtc } from '@utils/date.utils';
import {
  ChannelDecisionRepository,
  type ChannelDecisionReadRow,
  type ChannelSelectionReadRow,
  type PersistedChannelDecision,
} from './channel-decision.repository';
import {
  ChannelStrategyOrchestrator,
  createChannelStrategyOrchestrator,
} from '@evcore/analysis-core';
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
  id: string;
  market: Market;
  pick: string;
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
  fixtureStatus: FixtureStatus;
  modelRunId: string;
  competition: string | null;
  competitionName: string | null;
  country: string | null;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  // Informational only (coach-continuity.constants.ts) — true when that team
  // has played fewer than NEW_COACH_WINDOW_MATCHES finished matches under
  // its current coach as of this fixture. Never feeds scoring/EV.
  homeNewCoach: boolean;
  awayNewCoach: boolean;
  kickoff: string;
  scheduledAt: string;
  score: string | null;
  htScore: string | null;
  phase: ModelRunPhase;
  channel: StrategyChannel;
  status: ChannelDecisionStatus;
  reasonCode: string | null;
  reasonDetails: unknown;
  // When this specific ChannelDecision was written — see
  // ChannelDecisionReadRow.createdAt. Not surfaced on the primaries' cards
  // today (their own ModelRun.phase already conveys "when"), but it's the
  // only accurate "decided at" for a later, separate pass like VANTAGE's.
  decidedAt: string;
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
  | 'decidedAt'
  | 'calibrationAlert'
  | 'selections'
>;

export type ChannelDecisionMatchItem = Pick<
  ChannelDecisionItem,
  | 'fixtureId'
  | 'fixtureStatus'
  | 'competition'
  | 'competitionName'
  | 'country'
  | 'homeTeam'
  | 'awayTeam'
  | 'homeLogo'
  | 'awayLogo'
  | 'homeNewCoach'
  | 'awayNewCoach'
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
  competition?: string[];
  channel?: StrategyChannel[];
  market?: Market;
  status?: ChannelDecisionStatus;
  phase?: ModelRunPhase;
};

export type LeagueFacet = {
  code: string;
  name: string;
  country: string;
  count: number;
};

export type ChannelFacet = { channel: StrategyChannel; count: number };

export type ChannelDecisionFacets = {
  leagues: LeagueFacet[];
  channels: ChannelFacet[];
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

  /**
   * Catch-up: force final re-settlement of every ChannelSelection on every
   * FINISHED fixture in [from, to] — idempotent, safe to re-run. Mirrors
   * CouponSettlementService.settleRange (doc §5): use after a settlement
   * resolver bug fix, or when a fixture's score was corrected after it was
   * already settled, to self-correct without re-analysing the fixture.
   */
  async settleRange(
    from: Date,
    to: Date,
  ): Promise<{ fixturesResettled: number; selectionsResettled: number }> {
    const fixtures =
      await this.repository.findFinishedFixturesWithSelectionsInRange(from, to);

    let selectionsResettled = 0;
    for (const fixture of fixtures) {
      if (fixture.homeScore === null || fixture.awayScore === null) continue;
      const { settled } = await this.settleFixtureSelections({
        fixtureId: fixture.id,
        scores: {
          homeScore: fixture.homeScore,
          awayScore: fixture.awayScore,
          homeHtScore: fixture.homeHtScore,
          awayHtScore: fixture.awayHtScore,
        },
        mode: 'final',
      });
      selectionsResettled += settled;
    }

    return { fixturesResettled: fixtures.length, selectionsResettled };
  }

  // Read API (doc §5): normalised per-channel decisions for a day, grouped by
  // match or by channel. REJECTED decisions + reasonCode are exposed.
  async listByMatch(
    query: ChannelDecisionListQuery,
  ): Promise<ChannelDecisionMatchItem[]> {
    const rows = await this.findRows(query);
    const resultMap = buildResultMap(rows);
    const newCoachTeams = await this.repository.findNewCoachTeams(
      teamAsOfFromRows(rows),
    );
    const groups = new Map<string, ChannelDecisionMatchItem>();

    for (const row of rows) {
      const item = enrichAvoidItem(this.toItem(row, newCoachTeams), resultMap);
      let group = groups.get(item.fixtureId);
      if (group === undefined) {
        group = {
          fixtureId: item.fixtureId,
          fixtureStatus: item.fixtureStatus,
          competition: item.competition,
          competitionName: item.competitionName,
          country: item.country,
          homeTeam: item.homeTeam,
          awayTeam: item.awayTeam,
          homeLogo: item.homeLogo,
          awayLogo: item.awayLogo,
          homeNewCoach: item.homeNewCoach,
          awayNewCoach: item.awayNewCoach,
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
    const newCoachTeams = await this.repository.findNewCoachTeams(
      teamAsOfFromRows(rows),
    );
    const groups = new Map<StrategyChannel, ChannelDecisionItem[]>();

    for (const row of rows) {
      const item = enrichAvoidItem(this.toItem(row, newCoachTeams), resultMap);
      const group = groups.get(item.channel) ?? [];
      group.push(item);
      groups.set(item.channel, group);
    }

    return READ_CHANNEL_ORDER.flatMap((channel) => {
      const decisions = groups.get(channel);
      return decisions === undefined ? [] : [{ channel, decisions }];
    });
  }

  // Facet drawer (§2bis) — leagues + channels present that day, with counts,
  // aggregated in memory from one cheap query (findFacetRows's own comment).
  // Counts are per-dimension over the whole day, not cross-filtered by the
  // other dimension's current selection — simpler and still cheap, and
  // standard enough for a facet UI (it never hides a value the user could
  // still reach by clearing the other section first).
  async getFacets(date: string): Promise<ChannelDecisionFacets> {
    const day = new Date(date);
    const rows = await this.repository.findFacetRows({
      gte: startOfUtcDay(day),
      lte: endOfUtcDay(day),
    });

    const leagueByCode = new Map<string, LeagueFacet>();
    const channelCounts = new Map<StrategyChannel, number>();

    for (const row of rows) {
      const league = leagueByCode.get(row.code);
      if (league) league.count += 1;
      else {
        leagueByCode.set(row.code, {
          code: row.code,
          name: row.name,
          country: row.country,
          count: 1,
        });
      }

      // Facet-drawer-only exclusion (§2bis point 5) — narrower than
      // READ_CHANNEL_ORDER (which still lists AVOID/CONSENSUS as real "Par
      // canal" tabs, gating/aggregating the primaries respectively): none of
      // CONSENSUS/CONTRARIAN/AVOID emit a pick of their own, so filtering
      // decisions BY one of them would never narrow anything. VANTAGE stays
      // excluded too, same as everywhere else in this file — its own
      // Arbitrage view, not a "Par canal" channel.
      if (!FACET_EXCLUDED_CHANNELS.has(row.channel)) {
        channelCounts.set(
          row.channel,
          (channelCounts.get(row.channel) ?? 0) + 1,
        );
      }
    }

    const facetChannelOrder = READ_CHANNEL_ORDER.filter(
      (channel) => !FACET_EXCLUDED_CHANNELS.has(channel),
    );

    return {
      leagues: [...leagueByCode.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      channels: facetChannelOrder
        .map((channel) => ({
          channel,
          count: channelCounts.get(channel) ?? 0,
        }))
        .filter((c) => c.count > 0),
    };
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

  private toItem(
    row: ChannelDecisionReadRow,
    newCoachTeams: ReadonlySet<string>,
  ): ChannelDecisionItem {
    return {
      id: row.id,
      fixtureId: row.fixtureId,
      fixtureStatus: row.fixtureStatus,
      modelRunId: row.modelRunId,
      competition: row.competitionCode,
      competitionName: row.competitionName,
      country: row.country,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      homeLogo: row.homeLogo,
      awayLogo: row.awayLogo,
      homeNewCoach: newCoachTeams.has(row.homeTeamId),
      awayNewCoach: newCoachTeams.has(row.awayTeamId),
      kickoff: formatTimeUtc(row.scheduledAt),
      scheduledAt: row.scheduledAt.toISOString(),
      score: formatScoreLine(row.homeScore, row.awayScore),
      htScore: formatScoreLine(row.homeHtScore, row.awayHtScore),
      phase: row.phase,
      channel: row.channel,
      status: row.status,
      reasonCode: row.reasonCode,
      reasonDetails: row.reasonDetails,
      decidedAt: row.createdAt.toISOString(),
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
  STRATEGY_CHANNEL.CLEAN_SHEET,
  STRATEGY_CHANNEL.TEAM_TOTAL,
  STRATEGY_CHANNEL.WIN_EITHER_HALF,
  STRATEGY_CHANNEL.CORRECT_SCORE,
  STRATEGY_CHANNEL.RESULT_TOTAL_GOALS,
  STRATEGY_CHANNEL.OVER_UNDER_HT,
  STRATEGY_CHANNEL.FIRST_HALF,
  STRATEGY_CHANNEL.HALF_TIME_FULL_TIME,
  STRATEGY_CHANNEL.DOUBLE_CHANCE,
  STRATEGY_CHANNEL.RESULT_BTTS,
  STRATEGY_CHANNEL.DRAW_NO_BET,
  STRATEGY_CHANNEL.WIN_TO_NIL,
  // VANTAGE is deliberately absent — it has its own dedicated view
  // (GET /channel-decisions/by-match?channel=VANTAGE, apps/web's
  // /dashboard/arbitrage) since 2026-08-28, showing its full LLM reasoning
  // rather than a bare pick chip like the primaries above. It briefly lived
  // here (see git history) purely to fix the same "silently missing from
  // READ_CHANNEL_ORDER" bug this list has hit before (CORRECT_SCORE, then
  // CLEAN_SHEET/TEAM_TOTAL/WIN_EITHER_HALF) — that fix is superseded by the
  // dedicated page, not a regression of it. This exclusion only affects
  // "Par canal" (channel-decision.service.spec.ts's listByChannel test
  // matches); "Par match" excludes VANTAGE separately in the frontend, see
  // apps/web's decision-helpers.ts.
  // AVOID gates the primaries above; CONSENSUS aggregates them last.
  STRATEGY_CHANNEL.AVOID,
  STRATEGY_CHANNEL.CONSENSUS,
];

// Meta-channels with no pick of their own (§2bis point 5) — real "Par canal"
// tabs (READ_CHANNEL_ORDER includes them, gating/aggregating the primaries),
// but never a useful facet to filter BY, since none of them ever narrows a
// selection. CONTRARIAN isn't in READ_CHANNEL_ORDER either (never wired into
// "Par canal"), listed here anyway per the doc's own exclusion list.
const FACET_EXCLUDED_CHANNELS = new Set<StrategyChannel>([
  STRATEGY_CHANNEL.CONSENSUS,
  STRATEGY_CHANNEL.CONTRARIAN,
  STRATEGY_CHANNEL.AVOID,
]);

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
    decidedAt: item.decidedAt,
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

// One entry per team appearing in `rows`, keyed by teamId — a team plays at
// most once on any given date (the scope every caller queries at), so no
// per-fixture disambiguation is needed here.
function teamAsOfFromRows(rows: ChannelDecisionReadRow[]): Map<string, Date> {
  const teamAsOf = new Map<string, Date>();
  for (const row of rows) {
    teamAsOf.set(row.homeTeamId, row.scheduledAt);
    teamAsOf.set(row.awayTeamId, row.scheduledAt);
  }
  return teamAsOf;
}

function toSelectionItem(
  selection: ChannelSelectionReadRow,
): ChannelSelectionItem {
  const toNumber = (value: { toString(): string } | null): number | null =>
    value === null ? null : Number(value);
  return {
    id: selection.id,
    market: selection.market,
    pick: selection.pick,
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
