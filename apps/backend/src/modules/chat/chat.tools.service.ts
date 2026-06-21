import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { CouponProposalStatus } from '@evcore/db';
import { formatDateUtc } from '@utils/date.utils';
import { CouponService } from '@modules/coupon/coupon.service';
import { CHANNEL_STRATEGY_CONFIG } from '@modules/betting-engine/strategies/channel-strategy.config';
import { CHAT_LIMITS } from './chat.constants';
import { round } from './chat.math';
import { ChatReadRepository } from './chat.read.repository';
import { CHAT_TOOL_SCHEMAS, type ChatToolName } from './chat.tools.schemas';
import { simulateLadder } from './simulate-ladder';
import type { ChatRequestUser, ChatStreamPick } from './chat.types';
import {
  ChatPickEngineService,
  type CompactPick,
} from './chat.pick-engine.service';

type ToolContext = {
  user: ChatRequestUser;
};

type ToolExecutionInput = {
  name: string;
  rawArgs: string;
  context: ToolContext;
};

@Injectable()
export class ChatToolsService {
  constructor(
    private readonly readRepo: ChatReadRepository,
    private readonly coupon: CouponService,
    private readonly pickEngine: ChatPickEngineService,
  ) {}

  async execute(input: ToolExecutionInput): Promise<{
    content: string;
    parsedArgs: Record<string, unknown>;
    streamPicks?: ChatStreamPick[];
  }> {
    if (!isToolName(input.name)) {
      return {
        content: JSON.stringify({ error: `Unknown tool: ${input.name}` }),
        parsedArgs: {},
      };
    }

    const parsed = parseToolArgs(input.name, input.rawArgs);
    if (!parsed.success) {
      return {
        content: JSON.stringify({ error: parsed.error }),
        parsedArgs: {},
      };
    }

    const result = await this.runTool({
      name: input.name,
      args: parsed.args,
      context: input.context,
    });

    const streamPicks = extractStreamPicks(input.name, result);
    return {
      content: JSON.stringify(result),
      parsedArgs: parsed.args as Record<string, unknown>,
      ...(streamPicks ? { streamPicks } : {}),
    };
  }

  private runTool(input: {
    name: ChatToolName;
    args: unknown;
    context: ToolContext;
  }) {
    switch (input.name) {
      case 'searchFixtures':
        return this.searchFixtures(input.args);
      case 'getTopPicks':
        return this.getTopPicks(input.args);
      case 'getUpcomingPicks':
        return this.getUpcomingPicks(input.args);
      case 'getCouponProposals':
        return this.getCouponProposals(input.args);
      case 'composeSelection':
        return this.composeSelection(input.args);
      case 'simulateLadder':
        return simulateLadder(
          input.args as Parameters<typeof simulateLadder>[0],
        );
      case 'planLadder':
        return this.planLadder(input.args);
      case 'explainFixture':
        return this.explainFixture(input.args);
      case 'getChannelPerformance':
        return this.getChannelPerformance(input.args);
      case 'getLeaguePerformance':
        return this.getLeaguePerformance(input.args);
      case 'getLeagueChannelConfig':
        return this.getLeagueChannelConfig(input.args);
      case 'getPredictionOutcomes':
        return this.getPredictionOutcomes(input.args);
      case 'getSegmentPerformance':
        return this.getSegmentPerformance(input.args);
      case 'getMLMetrics':
        return this.getMLMetrics(input.args, input.context);
      case 'getEdgeAnalysis':
        return this.getEdgeAnalysis(input.args);
      case 'getEngineHealth':
        return this.getEngineHealth();
      case 'getPicksWithEvaluation':
        return this.getPicksWithEvaluation(input.args);
      case 'getMyStats':
        return this.getMyStats(input.args, input.context);
    }
  }

  private async planLadder(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.planLadder.parse(args);
    return this.pickEngine.planLadder(input);
  }

  private async searchFixtures(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.searchFixtures.parse(args);
    const rows = await this.readRepo.searchFixtures({
      query: input.query,
      status: input.status,
      limit: input.limit ?? CHAT_LIMITS.maxToolRows,
      range: {
        from: input.from ? new Date(`${input.from}T00:00:00.000Z`) : undefined,
        to: input.to ? new Date(`${input.to}T23:59:59.999Z`) : undefined,
      },
    });

    return { asOf: new Date().toISOString(), fixtures: rows };
  }

  private async getTopPicks(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.getTopPicks.parse(args);
    return this.pickEngine.getTopPicks(input);
  }

  private async getUpcomingPicks(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.getUpcomingPicks.parse(args);
    return this.pickEngine.getUpcomingPicks({
      date: input.date,
      canal: input.canal,
      limit: input.limit ?? CHAT_LIMITS.maxToolRows,
    });
  }

  private async getCouponProposals(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.getCouponProposals.parse(args);
    const date = input.date ?? formatDateUtc(new Date());
    const status = input.status as CouponProposalStatus | undefined;
    const coupons = await this.coupon.getCoupons(date, status);

    return {
      asOf: new Date().toISOString(),
      date,
      coupons: coupons.map((coupon) => ({
        id: coupon.id,
        rank: coupon.rank,
        status: coupon.status,
        result: coupon.result,
        combinedOdds: round(coupon.combinedOdds),
        jointProbability: round(product(coupon.legs.map((l) => l.probability))),
        signalScore: round(coupon.signalScore),
        legs: coupon.legs.map((leg) => ({
          fixtureId: leg.fixtureId,
          match: `${leg.homeTeam} - ${leg.awayTeam}`,
          competition: leg.competition,
          canal: leg.canal,
          market: leg.market,
          pick: leg.pick,
          probability: round(leg.probability),
          odds: leg.oddsSnapshot,
        })),
      })),
    };
  }

  private async composeSelection(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.composeSelection.parse(args);
    return this.pickEngine.composeSelection(input);
  }

  private async explainFixture(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.explainFixture.parse(args);
    const explanation = await this.readRepo.getFixtureExplanation(
      input.fixtureId,
    );
    return explanation ?? { error: 'Fixture not found' };
  }
  // ── Groupe B ─────────────────────────────────────────────────────────────

  private async getChannelPerformance(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.getChannelPerformance.parse(args);
    const range = toDateRange(input.from, input.to);
    const stats = await this.readRepo.getChannelPerfStats({
      range,
      channel: input.channel,
    });
    return {
      asOf: new Date().toISOString(),
      from: input.from,
      to: input.to,
      channels: stats,
    };
  }

  private async getLeaguePerformance(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.getLeaguePerformance.parse(args);
    const range = toDateRange(input.from, input.to);
    const leagues = await this.readRepo.getLeagueStats({
      channel: input.channel,
      range,
    });
    return {
      asOf: new Date().toISOString(),
      channel: input.channel,
      from: input.from,
      to: input.to,
      leagues,
    };
  }

  private getLeagueChannelConfig(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.getLeagueChannelConfig.parse(args);
    const entries = input.competition
      ? [
          [
            input.competition,
            CHANNEL_STRATEGY_CONFIG[input.competition] ?? {},
          ] as const,
        ]
      : Object.entries(CHANNEL_STRATEGY_CONFIG);

    const result = entries.map(([comp, channels]) => ({
      competition: comp,
      channels: Object.entries(channels).map(([ch, cfg]) => ({
        channel: ch,
        enabled: cfg.enabled,
        threshold: cfg.threshold,
        minSampleN: cfg.minSampleN,
      })),
    }));

    return Promise.resolve({ leagues: result });
  }

  private async getPredictionOutcomes(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.getPredictionOutcomes.parse(args);
    const range = toDateRange(input.from, input.to);
    const outcomes = await this.readRepo.getSettledOutcomes({
      range,
      canal: input.canal,
      onlyMisses: input.onlyMisses ?? false,
      limit: CHAT_LIMITS.maxToolRows,
    });
    return {
      asOf: new Date().toISOString(),
      from: input.from,
      to: input.to,
      outcomes,
    };
  }

  private async getSegmentPerformance(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.getSegmentPerformance.parse(args);
    const range = toDateRange(input.from, input.to);
    const segments = await this.readRepo.getChannelPerfStats({ range });
    return {
      asOf: new Date().toISOString(),
      from: input.from,
      to: input.to,
      segments,
    };
  }

  // ── Groupe C ─────────────────────────────────────────────────────────────

  private async getMLMetrics(args: unknown, ctx: ToolContext) {
    const input = CHAT_TOOL_SCHEMAS.getMLMetrics.parse(args);
    const isAdmin = ctx.user.role === 'ADMIN';
    const models = await this.readRepo.getMlModelVersions({
      segment: input.segment,
      activeOnly: !isAdmin,
    });

    return {
      asOf: new Date().toISOString(),
      adminView: isAdmin,
      models: models.map((m) => {
        const metrics = m.metrics as Record<string, number | undefined>;
        return {
          id: m.id,
          segment: m.segment,
          algorithm: m.algorithm,
          isActive: m.isActive,
          brierScore: metrics['brierScore'] ?? null,
          calibrationError: metrics['calibrationError'] ?? null,
          roiShadow: metrics['roiShadow'] ?? null,
          sampleSize: metrics['sampleSize'] ?? null,
          activatedAt: m.activatedAt,
          createdAt: m.createdAt,
          notes: m.notes ?? null,
          legacyMetrics:
            m.activatedAt !== null &&
            new Date(m.activatedAt) < new Date('2026-06-11'),
        };
      }),
    };
  }

  private async getEdgeAnalysis(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.getEdgeAnalysis.parse(args);
    const range = toDateRange(input.from, input.to);
    const segments = await this.readRepo.getEdgeStats({ range });
    return {
      asOf: new Date().toISOString(),
      from: input.from,
      to: input.to,
      segments,
    };
  }

  // ── Groupe F ─────────────────────────────────────────────────────────────

  private async getPicksWithEvaluation(args: unknown) {
    const input = CHAT_TOOL_SCHEMAS.getPicksWithEvaluation.parse(args);
    const date = input.date ?? formatDateUtc(new Date());
    return this.readRepo.getPicksWithEvaluation({
      date,
      limit: CHAT_LIMITS.maxEvaFixtures,
      maxPicksPerFixture: CHAT_LIMITS.maxEvaPicksPerFixture,
    });
  }

  // ── Groupe D ─────────────────────────────────────────────────────────────

  private async getEngineHealth() {
    const data = await this.readRepo.getEngineHealthData();
    return { asOf: new Date().toISOString(), ...data };
  }

  // ── Groupe E ─────────────────────────────────────────────────────────────

  private async getMyStats(args: unknown, ctx: ToolContext) {
    const input = CHAT_TOOL_SCHEMAS.getMyStats.parse(args);
    const range = toDateRange(input.from, input.to);
    const stats = await this.readRepo.getUserBetStats({
      userId: ctx.user.id,
      range,
    });
    return {
      asOf: new Date().toISOString(),
      from: input.from,
      to: input.to,
      ...stats,
    };
  }
}

function toDateRange(from: string, to: string): { from: Date; to: Date } {
  return {
    from: new Date(`${from}T00:00:00.000Z`),
    to: new Date(`${to}T23:59:59.999Z`),
  };
}

function isToolName(name: string): name is ChatToolName {
  return name in CHAT_TOOL_SCHEMAS;
}

// Picks worth rendering as cards in the UI, depending on the tool shape.
function extractStreamPicks(
  name: ChatToolName,
  result: unknown,
): ChatStreamPick[] | undefined {
  if (name === 'getUpcomingPicks') {
    return toStreamPicks((result as { picks: CompactPick[] }).picks);
  }
  if (name === 'getTopPicks') {
    const days = (result as { days: Array<{ picks: CompactPick[] }> }).days;
    return toStreamPicks(days.flatMap((day) => day.picks));
  }
  if (name === 'composeSelection') {
    const selection = (result as { selection: { legs: CompactPick[] } | null })
      .selection;
    return selection ? toStreamPicks(selection.legs) : undefined;
  }
  if (name === 'planLadder') {
    const picks = (result as { picks?: CompactPick[] }).picks;
    return picks ? toStreamPicks(picks) : undefined;
  }
  return undefined;
}

function toStreamPicks(picks: CompactPick[]): ChatStreamPick[] | undefined {
  if (picks.length === 0) return undefined;
  return picks.slice(0, CHAT_LIMITS.maxStreamPicks).map((pick) => ({
    canal: pick.canal,
    match: pick.match,
    market: pick.market,
    pick: pick.pick,
    odds: pick.odds,
    proba: pick.probability,
    reliability: pick.reliability,
  }));
}

function parseToolArgs(name: ChatToolName, rawArgs: string) {
  try {
    const json = rawArgs ? JSON.parse(rawArgs) : {};
    const result = CHAT_TOOL_SCHEMAS[name].safeParse(json);
    if (!result.success) {
      return { success: false as const, error: result.error.message };
    }
    return { success: true as const, args: result.data };
  } catch {
    return { success: false as const, error: 'Invalid JSON tool arguments' };
  }
}

// Odds/probability math goes through decimal.js (EVCore hard rule).
function product(values: number[]): Decimal {
  return values.reduce((acc, value) => acc.mul(value), new Decimal(1));
}
