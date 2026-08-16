import type Decimal from "decimal.js";
import { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { priceForSelection } from "../selection";
import {
  getResultTotalGoalsLineConfigs,
  type ResultTotalGoalsLine,
  type ResultTotalGoalsLineConfig,
  type ResultTotalGoalsSide,
} from "./config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
  StrategySelection,
} from "./types";
import type { MatchProbabilities } from "../selection/types";
import type { ResultTotalGoalsProba } from "../probability";

// UNDER-only pick — see config.ts header for why OVER isn't covered here.
function resultTotalGoalsPick(
  side: ResultTotalGoalsSide,
  line: ResultTotalGoalsLine,
): string {
  return `${side}_UNDER_${line}`;
}

function resultTotalGoalsProbability(
  probabilities: MatchProbabilities,
  side: ResultTotalGoalsSide,
  line: ResultTotalGoalsLine,
): Decimal | undefined {
  const map: ResultTotalGoalsProba = probabilities.resultTotalGoals;
  return map[resultTotalGoalsPick(side, line) as keyof ResultTotalGoalsProba];
}

type ResultTotalGoalsCandidate = {
  config: ResultTotalGoalsLineConfig;
  market: Market;
  pick: string;
  probability: Decimal;
  priced: ReturnType<typeof priceForSelection>;
};

// Rank value-first (EV when priced), same tiebreak as TeamTotalStrategy.
function compareResultTotalGoalsCandidates(
  a: ResultTotalGoalsCandidate,
  b: ResultTotalGoalsCandidate,
): number {
  const aEv = a.priced.ev ?? null;
  const bEv = b.priced.ev ?? null;
  if (aEv !== null && bEv !== null) return bEv.comparedTo(aEv);
  if (aEv !== null) return -1;
  if (bEv !== null) return 1;
  return b.probability.comparedTo(a.probability);
}

// Pure RESULT_TOTAL_GOALS decision over an explicit set of (already enabled)
// line configs — mirrors decideTeamTotal, single (side, line) dimension
// instead of team-doubled.
export function decideResultTotalGoals(
  context: StrategyContext,
  lineConfigs: readonly ResultTotalGoalsLineConfig[],
): StrategyDecision {
  const channel = STRATEGY_CHANNEL.RESULT_TOTAL_GOALS;
  if (lineConfigs.length === 0) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const candidates: ResultTotalGoalsCandidate[] = [];
  let bestBelow: { probability: number; threshold: number } | null = null;
  for (const config of lineConfigs) {
    const probability = resultTotalGoalsProbability(
      context.probabilities,
      config.side,
      config.line,
    );
    if (probability === undefined) continue;
    if (probability.lessThan(config.threshold)) {
      const probabilityNum = probability.toNumber();
      if (bestBelow === null || probabilityNum > bestBelow.probability) {
        bestBelow = {
          probability: probabilityNum,
          threshold: config.threshold,
        };
      }
      continue;
    }
    const market = Market.RESULT_TOTAL_GOALS;
    const pick = resultTotalGoalsPick(config.side, config.line);
    candidates.push({
      config,
      market,
      pick,
      probability,
      priced: priceForSelection({
        odds: context.odds,
        market,
        pick,
        probability,
      }),
    });
  }

  if (candidates.length === 0) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "below_threshold",
      reasonDetails: bestBelow ?? {},
      selections: [],
    };
  }

  candidates.sort(compareResultTotalGoalsCandidates);
  const best = candidates[0];
  if (!best)
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_candidates",
      selections: [],
    };
  const selection: StrategySelection = {
    market: best.market,
    pick: best.pick,
    probability: best.probability,
    ...best.priced,
    rank: 1,
  };

  return {
    channel,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    selections: [selection],
  };
}

// RESULT_TOTAL_GOALS channel — pre-combined result×goals-line pick (UNDER
// only, see config.ts). Like TEAM_TOTAL, evaluates every enabled (side, line)
// config for the league and emits the single best one (by EV). OBSERVATION
// mode, no backtested segments yet — see config.ts header.
export class ResultTotalGoalsStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.RESULT_TOTAL_GOALS;
  readonly allowedMarkets: readonly Market[] = [Market.RESULT_TOTAL_GOALS];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideResultTotalGoals(
      context,
      getResultTotalGoalsLineConfigs(context.competitionCode),
    );
  }
}
