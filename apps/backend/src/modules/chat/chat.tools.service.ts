import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { CouponProposalStatus } from '@evcore/db';
import { formatDateUtc } from '@utils/date.utils';
import { AiEngineService } from '@modules/ai-engine/ai-engine.service';
import { CHAT_LIMITS } from './chat.constants';
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
    private readonly aiEngine: AiEngineService,
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

    return {
      asOf: new Date().toISOString(),
      fixtures: rows.map((fixture) => ({
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
      })),
    };
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
    const coupons = await this.aiEngine.getCoupons(date, status);

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
    const fixture = await this.readRepo.findFixtureForExplanation(
      input.fixtureId,
    );
    if (!fixture) return { error: 'Fixture not found' };
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
            decision: run.decision,
            finalScore: run.finalScore ? Number(run.finalScore) : null,
            deterministicScore: run.deterministicScore
              ? Number(run.deterministicScore)
              : null,
            mlDelta: run.mlDelta ? Number(run.mlDelta) : null,
            scoreThreshold: run.scoreThreshold
              ? Number(run.scoreThreshold)
              : null,
            evThreshold: run.evThreshold ? Number(run.evThreshold) : null,
            analyzedAt: run.analyzedAt.toISOString(),
            isBackfill: run.isBackfill,
          }
        : null,
      bets:
        run?.bets.map((bet) => ({
          id: bet.id,
          canal: bet.isSafeValue ? 'SV' : 'EV',
          market: bet.market,
          pick: bet.pick,
          probability: round(Number(bet.probEstimated)),
          odds: bet.oddsSnapshot ? Number(bet.oddsSnapshot) : null,
          ev: round(Number(bet.ev)),
          qualityScore: bet.qualityScore
            ? round(Number(bet.qualityScore))
            : null,
          stakePct: round(Number(bet.stakePct)),
          status: bet.status,
        })) ?? [],
      predictions: fixture.predictions.map((prediction) => ({
        channel: prediction.channel,
        market: prediction.market,
        pick: prediction.pick,
        probability: round(Number(prediction.probability)),
        correct: prediction.correct,
      })),
    };
  }
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

function round(value: number | Decimal): number {
  return new Decimal(value).toDecimalPlaces(4).toNumber();
}
