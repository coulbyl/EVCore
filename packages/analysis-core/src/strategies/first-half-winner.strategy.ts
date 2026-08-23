import { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { priceForSelection } from "../selection";
import { FIRST_HALF_WINNER_MIN_MARGIN } from "./first-half-winner.config";
import { getChannelStrategyConfig } from "./channel-strategy.config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";

// Pure FIRST_HALF_WINNER decision — mirrors decideDominant's argmax/margin
// shape (same STAKED-channel machinery like DOMINANT_MIN_ODDS/line-movement
// is skipped: this is OBSERVATION-only, no exposure, same simpler shape
// CORRECT_SCORE/CLEAN_SHEET already use).
export function decideFirstHalfWinner(
  context: StrategyContext,
): StrategyDecision {
  const channel = STRATEGY_CHANNEL.FIRST_HALF;

  // Same bivariate-Poisson-overestimation risk as HALF_TIME_FULL_TIME/
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

  const config = getChannelStrategyConfig(
    "FIRST_HALF",
    context.competitionCode,
  );
  if (!config.enabled) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const { home, draw, away } = context.probabilities.firstHalfWinner;
  const candidates = [
    { pick: "HOME", probability: home },
    { pick: "DRAW", probability: draw },
    { pick: "AWAY", probability: away },
  ].sort((a, b) => b.probability.comparedTo(a.probability));

  const [first, second] = candidates;
  if (!first || !second)
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_candidates",
      selections: [],
    };

  if (first.probability.lessThan(config.threshold)) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "below_threshold",
      reasonDetails: {
        probability: first.probability.toNumber(),
        threshold: config.threshold,
      },
      selections: [],
    };
  }

  if (
    first.probability
      .minus(second.probability)
      .lessThan(FIRST_HALF_WINNER_MIN_MARGIN)
  ) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "insufficient_margin",
      reasonDetails: {
        margin: first.probability.minus(second.probability).toNumber(),
        minMargin: FIRST_HALF_WINNER_MIN_MARGIN.toNumber(),
      },
      selections: [],
    };
  }

  return {
    channel,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    selections: [
      {
        market: Market.FIRST_HALF_WINNER,
        pick: first.pick,
        probability: first.probability,
        ...priceForSelection({
          odds: context.odds,
          market: Market.FIRST_HALF_WINNER,
          pick: first.pick,
          probability: first.probability,
        }),
        rank: 1,
      },
    ],
  };
}

// FIRST_HALF_WINNER channel — argmax(HOME/DRAW/AWAY) on the half-time result.
// Same shape as DOMINANT but a genuinely different signal: DRAW is the modal
// HT outcome in most htft-calibrated leagues (unlike full-time). Restricted
// to leagues with real HT decomposition history — see config.ts header.
export class FirstHalfWinnerStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.FIRST_HALF;
  readonly allowedMarkets: readonly Market[] = [Market.FIRST_HALF_WINNER];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideFirstHalfWinner(context);
  }
}
