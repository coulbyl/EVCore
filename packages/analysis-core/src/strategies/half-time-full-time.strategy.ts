import type Decimal from "decimal.js";
import { CHANNEL_DECISION_STATUS, Market, STRATEGY_CHANNEL } from "../types";
import {
  HALF_TIME_FULL_TIME_PICKS,
  type HalfTimeFullTimePick,
} from "../probability";
import { priceForSelection } from "../selection";
import { HALF_TIME_FULL_TIME_CONFIG } from "./half-time-full-time.config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";

type HtftCandidate = {
  pick: HalfTimeFullTimePick;
  probability: Decimal;
  priced: ReturnType<typeof priceForSelection>;
};

// Pure HALF_TIME_FULL_TIME decision — mirrors decideCorrectScore's shape:
// among the priced HT×FT combos, emit the single MOST LIKELY one (argmax
// probability, NOT argmax-EV — same fat-tail-noise reasoning CORRECT_SCORE's
// 2026-07-01 audit found on a large priced grid). Prediction, not value bet.
export function decideHalfTimeFullTime(
  context: StrategyContext,
): StrategyDecision {
  const channel = STRATEGY_CHANNEL.HALF_TIME_FULL_TIME;

  // Same bivariate-Poisson-overestimation risk as FIRST_HALF_WINNER/
  // OVER_UNDER_HT — restricted to leagues with real HT decomposition
  // history (SelectionConfig.htftCalibrated).
  if (!context.selectionConfig.htftCalibrated) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "market_suspended",
      selections: [],
    };
  }

  if (!HALF_TIME_FULL_TIME_CONFIG.enabled) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const candidates: HtftCandidate[] = [];
  for (const pick of HALF_TIME_FULL_TIME_PICKS) {
    const priced = priceForSelection({
      odds: context.odds,
      market: Market.HALF_TIME_FULL_TIME,
      pick,
      probability: context.probabilities.htft[pick],
    });
    if (priced.odds === undefined) continue;
    candidates.push({
      pick,
      probability: context.probabilities.htft[pick],
      priced,
    });
  }

  if (candidates.length === 0) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_priced_pick",
      selections: [],
    };
  }

  // Prediction: the single most likely combo (NOT argmax-EV — see decideCorrectScore).
  const best = candidates.reduce((a, b) =>
    b.probability.greaterThan(a.probability) ? b : a,
  );

  const minProbability = HALF_TIME_FULL_TIME_CONFIG.minProbability;
  if (best.probability.lessThan(minProbability)) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "below_conviction",
      reasonDetails: {
        bestPick: best.pick,
        bestProbability: best.probability.toNumber(),
      },
      selections: [],
    };
  }

  return {
    channel,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    selections: [
      {
        market: Market.HALF_TIME_FULL_TIME,
        pick: best.pick,
        probability: best.probability,
        ...best.priced,
        rank: 1,
      },
    ],
  };
}

// HALF_TIME_FULL_TIME channel — 9-way joint HT×FT grid. Same
// prediction-not-value-bet shape as CorrectScoreStrategy. Restricted to
// leagues with real HT decomposition history — see config.ts header.
export class HalfTimeFullTimeStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.HALF_TIME_FULL_TIME;
  readonly allowedMarkets: readonly Market[] = [Market.HALF_TIME_FULL_TIME];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideHalfTimeFullTime(context);
  }
}
