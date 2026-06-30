import type Decimal from "decimal.js";
import { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { priceForSelection } from "../selection";
import {
  getGoalsLineConfigs,
  type GoalsLine,
  type GoalsLineConfig,
  type GoalsSide,
} from "./config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
  StrategySelection,
} from "./types";
import type { MatchProbabilities } from "../selection/types";

// Maps a (line, side) to the OVER_UNDER pick string used across odds-mapping,
// settlement and the odds snapshot. The 2.5 line keeps the bare OVER/UNDER
// labels for historical reasons; the others carry the line in the name.
const GOALS_PICK: Record<GoalsLine, Record<GoalsSide, string>> = {
  1.5: { OVER: "OVER_1_5", UNDER: "UNDER_1_5" },
  2.5: { OVER: "OVER", UNDER: "UNDER" },
  3.5: { OVER: "OVER_3_5", UNDER: "UNDER_3_5" },
  4.5: { OVER: "OVER_4_5", UNDER: "UNDER_4_5" },
};

function goalsProbability(
  probabilities: MatchProbabilities,
  line: GoalsLine,
  side: GoalsSide,
): Decimal {
  if (line === 1.5)
    return side === "OVER" ? probabilities.over15 : probabilities.under15;
  if (line === 2.5)
    return side === "OVER" ? probabilities.over25 : probabilities.under25;
  if (line === 3.5)
    return side === "OVER" ? probabilities.over35 : probabilities.under35;
  return side === "OVER" ? probabilities.over45 : probabilities.under45;
}

type GoalsCandidate = {
  config: GoalsLineConfig;
  pick: string;
  probability: Decimal;
  priced: ReturnType<typeof priceForSelection>;
};

// Rank candidates value-first: highest EV when priced, then highest probability
// for price-less candidates (kept for analytical settlement when no book price
// exists). Mirrors the value-driven ordering used for coupons.
function compareGoalsCandidates(a: GoalsCandidate, b: GoalsCandidate): number {
  const aEv = a.priced.ev ?? null;
  const bEv = b.priced.ev ?? null;
  if (aEv !== null && bEv !== null) return bEv.comparedTo(aEv);
  if (aEv !== null) return -1;
  if (bEv !== null) return 1;
  return b.probability.comparedTo(a.probability);
}

// Pure GOALS decision over an explicit set of (already enabled) line configs.
// Kept separate from the class so it can be tested without the module-level
// config (every prod GOALS segment starts disabled pending per-season tuning).
export function decideGoals(
  context: StrategyContext,
  lineConfigs: readonly GoalsLineConfig[],
): StrategyDecision {
  const channel = STRATEGY_CHANNEL.GOALS;
  if (lineConfigs.length === 0) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const candidates: GoalsCandidate[] = [];
  let bestBelow: { probability: number; threshold: number } | null = null;
  for (const config of lineConfigs) {
    const pick = GOALS_PICK[config.line][config.side];
    const probability = goalsProbability(
      context.probabilities,
      config.line,
      config.side,
    );
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
    candidates.push({
      config,
      pick,
      probability,
      priced: priceForSelection({
        odds: context.odds,
        market: Market.OVER_UNDER,
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

  candidates.sort(compareGoalsCandidates);
  const best = candidates[0];
  if (!best)
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_candidates",
      selections: [],
    };
  const selection: StrategySelection = {
    market: Market.OVER_UNDER,
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

// GOALS channel — Over/Under on the total goals line. Unlike the single-signal
// channels, GOALS evaluates every enabled (line × side) config for the league
// and emits the single best one (by EV) as the fixture's selection. Activation
// is per (league × line × side) in GOALS_CONFIG, calibrated separately.
export class GoalsStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.GOALS;
  readonly allowedMarkets: readonly Market[] = [Market.OVER_UNDER];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideGoals(context, getGoalsLineConfigs(context.competitionCode));
  }
}
