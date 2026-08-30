import Decimal from "decimal.js";
import { CHANNEL_DECISION_STATUS, Market, STRATEGY_CHANNEL } from "../types";
import { computeCorrectScoreMatrix } from "../probability";
import { priceForSelection } from "../selection";
import { CORRECT_SCORE_CONFIG } from "./correct-score.config";
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
// MOST LIKELY exact score the model can price. Observation-only (never staked).
// This is a prediction, not a value bet — see CORRECT_SCORE_CONFIG for why
// argmax-EV was rejected (fat-tail longshot noise).
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
  if (lambdaHome == null || lambdaAway == null) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_model",
      selections: [],
    };
  }

  // Computed as soon as lambdas exist, independent of odds availability
  // (moved ahead of the `no_odds` check on 2026-08-30) — 99.99% of
  // CORRECT_SCORE's rejections were `no_odds`, and until this change none of
  // them carried the model's own modal-scoreline opinion in reasonDetails,
  // even though it never depended on pricing to begin with. Staking/
  // selection still requires a real price (unchanged below); this only
  // means a rejection for missing odds no longer also throws away the
  // model's read.
  const matrix = computeCorrectScoreMatrix(lambdaHome, lambdaAway);
  const modal = Object.entries(matrix).reduce<{
    scoreline: string;
    probability: Decimal;
  } | null>(
    (best, [scoreline, probability]) =>
      !best || probability.greaterThan(best.probability)
        ? { scoreline, probability }
        : best,
    null,
  );

  const priced = context.odds?.correctScoreOdds;
  if (!priced || Object.keys(priced).length === 0) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_odds",
      reasonDetails: modal
        ? {
            bestScoreline: modal.scoreline,
            bestProbability: modal.probability.toNumber(),
          }
        : {},
      selections: [],
    };
  }

  const candidates: ScoreCandidate[] = [];
  for (const [scoreline, odds] of Object.entries(priced)) {
    if (odds == null) continue;
    const probability = matrix[scoreline];
    // Skip scorelines beyond the model grid (no cell probability to predict on).
    if (!probability) continue;
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
      reasonDetails: modal
        ? {
            bestScoreline: modal.scoreline,
            bestProbability: modal.probability.toNumber(),
          }
        : {},
      selections: [],
    };
  }

  // Prediction: the single most likely scoreline (NOT argmax-EV — that selects
  // fat-tail longshot noise; see CORRECT_SCORE_CONFIG).
  const best = candidates.reduce((a, b) =>
    b.probability.greaterThan(a.probability) ? b : a,
  );
  // Conviction gate: if even the modal scoreline is below the floor, the match is
  // too open to name a single score → no pick.
  const minProbability = new Decimal(CORRECT_SCORE_CONFIG.minProbability);
  if (best.probability.lessThan(minProbability)) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "below_conviction",
      reasonDetails: {
        bestScoreline: best.scoreline,
        bestProbability: best.probability.toNumber(),
      },
      selections: [],
    };
  }

  // H2H scoreline signal (memory project-correct-score-immature, validated
  // 2026-08-15): when the pick agrees with the decay-weighted most frequent
  // H2H scoreline (n>=3 legs), hit rate is measurably higher — confirmed
  // even against the lambda already adjusted for H2H (v2.0), so this is not
  // double-counting. Surfaced as a confidence signal only: CORRECT_SCORE
  // stays a pure argmax prediction, this never changes which scoreline is
  // picked, only how much to trust it once picked.
  const h2hScoreline = context.signals.h2hScoreline ?? null;
  const h2hScorelineAgreement =
    h2hScoreline !== null && h2hScoreline === best.scoreline;

  return {
    channel: ch,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    reasonDetails: {
      h2hScorelineAgreement,
      h2hScoreline,
      h2hScorelineConfidence: context.signals.h2hScorelineConfidence ?? null,
    },
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
