import Decimal from "decimal.js";
import { CHANNEL_DECISION_STATUS, Market, STRATEGY_CHANNEL } from "../types";
import { computeCorrectScoreMatrix } from "../probability";
import { priceForSelection } from "../selection";
import { CORRECT_SCORE_CONFIG } from "./config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";

type ScoreCandidate = {
  scoreline: string;
  probability: Decimal;
  odds: Decimal;
  ev: Decimal;
};

// Pure decision: given lambdas + the book's priced scorelines, emit the single
// best-EV exact score the model can price. Observation-only (never staked).
export function decideCorrectScore(context: StrategyContext): StrategyDecision {
  const ch = STRATEGY_CHANNEL.CORRECT_SCORE;
  if (!CORRECT_SCORE_CONFIG.enabled) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const { lambdaHome, lambdaAway } = context;
  const priced = context.odds?.correctScoreOdds;
  if (lambdaHome == null || lambdaAway == null) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_model",
      selections: [],
    };
  }
  if (!priced || Object.keys(priced).length === 0) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_odds",
      selections: [],
    };
  }

  const matrix = computeCorrectScoreMatrix(lambdaHome, lambdaAway);
  const minProbability = new Decimal(CORRECT_SCORE_CONFIG.minProbability);
  const candidates: ScoreCandidate[] = [];
  for (const [scoreline, odds] of Object.entries(priced)) {
    if (odds == null) continue;
    const probability = matrix[scoreline];
    // Skip scorelines beyond the model grid or below the longshot-noise floor.
    if (!probability || probability.lessThan(minProbability)) continue;
    candidates.push({
      scoreline,
      probability,
      odds,
      ev: probability.times(odds).minus(1),
    });
  }

  if (candidates.length === 0) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_modelable_scoreline",
      selections: [],
    };
  }

  const best = candidates.reduce((a, b) => (b.ev.greaterThan(a.ev) ? b : a));
  if (best.ev.lessThan(CORRECT_SCORE_CONFIG.minEv)) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "below_ev",
      reasonDetails: {
        bestScoreline: best.scoreline,
        bestEv: best.ev.toNumber(),
      },
      selections: [],
    };
  }

  return {
    channel: ch,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    selections: [
      {
        market: Market.CORRECT_SCORE,
        pick: best.scoreline,
        probability: best.probability,
        ...priceForSelection({
          odds: context.odds,
          market: Market.CORRECT_SCORE,
          pick: best.scoreline,
          probability: best.probability,
        }),
        rank: 1,
      },
    ],
  };
}

export class CorrectScoreStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.CORRECT_SCORE;
  readonly allowedMarkets: readonly Market[] = [Market.CORRECT_SCORE];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideCorrectScore(context);
  }
}
