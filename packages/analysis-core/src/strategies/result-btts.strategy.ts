import { rankLineCandidates, type RankingOptions } from "./ranking";
import type Decimal from "decimal.js";
import { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { priceForSelection } from "../selection";
import {
  getResultBttsPickConfigs,
  type ResultBttsOutcome,
  type ResultBttsPickConfig,
  type ResultBttsSide,
} from "./result-btts.config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
  StrategySelection,
} from "./types";
import type { MatchProbabilities } from "../selection/types";
import type { ResultBttsProba } from "../probability";

function resultBttsPick(
  side: ResultBttsSide,
  outcome: ResultBttsOutcome,
): string {
  return `${side}_${outcome}`;
}

function resultBttsProbability(
  probabilities: MatchProbabilities,
  side: ResultBttsSide,
  outcome: ResultBttsOutcome,
): Decimal | undefined {
  const map: ResultBttsProba = probabilities.resultBtts;
  return map[resultBttsPick(side, outcome) as keyof ResultBttsProba];
}

type ResultBttsCandidate = {
  config: ResultBttsPickConfig;
  market: Market;
  pick: string;
  probability: Decimal;
  priced: ReturnType<typeof priceForSelection>;
};

// Pure RESULT_BTTS decision over an explicit set of (already enabled) pick
// configs — mirrors decideResultTotalGoals, (side, outcome) dimension instead
// of (side, line).
export function decideResultBtts(
  context: StrategyContext,
  pickConfigs: readonly ResultBttsPickConfig[],
  options: RankingOptions = {},
): StrategyDecision {
  const channel = STRATEGY_CHANNEL.RESULT_BTTS;
  if (pickConfigs.length === 0) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const candidates: ResultBttsCandidate[] = [];
  let bestBelow: { probability: number; threshold: number } | null = null;
  for (const config of pickConfigs) {
    const probability = resultBttsProbability(
      context.probabilities,
      config.side,
      config.outcome,
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
    const market = Market.RESULT_BTTS;
    const pick = resultBttsPick(config.side, config.outcome);
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

  const ranked = rankLineCandidates(candidates, options);
  const best = ranked[0];
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

// RESULT_BTTS channel — pre-combined result×BTTS pick. Like RESULT_TOTAL_GOALS,
// evaluates every enabled (side, outcome) config for the league and emits the
// single best one (by EV). OBSERVATION mode, no backtested segments yet — see
// config.ts header.
export class ResultBttsStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.RESULT_BTTS;
  readonly allowedMarkets: readonly Market[] = [Market.RESULT_BTTS];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideResultBtts(
      context,
      getResultBttsPickConfigs(context.competitionCode),
    );
  }
}
