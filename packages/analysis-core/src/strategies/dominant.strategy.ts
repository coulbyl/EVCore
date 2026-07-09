import { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { priceForSelection } from "../selection";
import { LINE_MOVEMENT_THRESHOLD } from "../selection/constants";
import { DOMINANT_MIN_MARGIN, getChannelStrategyConfig } from "./config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";

export class DominantStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.DOMINANT;
  readonly allowedMarkets: readonly Market[] = [Market.ONE_X_TWO];

  evaluate(context: StrategyContext): StrategyDecision {
    const ch = this.channel;
    const config = getChannelStrategyConfig(
      "DOMINANT",
      context.competitionCode,
    );
    if (!config?.enabled) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.DISABLED,
        selections: [],
      };
    }

    const { home, draw, away } = context.probabilities;
    const candidates = [
      { pick: "HOME", probability: home },
      { pick: "DRAW", probability: draw },
      { pick: "AWAY", probability: away },
    ].sort((a, b) => b.probability.comparedTo(a.probability));

    const [first, second] = candidates;
    if (!first || !second)
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: "no_candidates",
        selections: [],
      };

    if (first.probability.lessThan(config.threshold)) {
      return {
        channel: ch,
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
      first.probability.minus(second.probability).lessThan(DOMINANT_MIN_MARGIN)
    ) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: "insufficient_margin",
        reasonDetails: {
          margin: first.probability.minus(second.probability).toNumber(),
          minMargin: DOMINANT_MIN_MARGIN.toNumber(),
        },
        selections: [],
      };
    }

    // Same fixture-level adverse-drift guard as ValueStrategy (rapport-dev
    // 2026-07-09, point #2): DOMINANT is a staked channel and was previously
    // the only one of the three staked channels with no line-movement check
    // at all — a pick could clear every threshold while the market had
    // already moved sharply against it.
    if (
      context.signals.lineMovement !== null &&
      context.signals.lineMovement > LINE_MOVEMENT_THRESHOLD.toNumber()
    ) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: "line_movement",
        reasonDetails: { movement: context.signals.lineMovement },
        selections: [],
      };
    }

    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.SELECTED,
      selections: [
        {
          market: Market.ONE_X_TWO,
          pick: first.pick,
          probability: first.probability,
          ...priceForSelection({
            odds: context.odds,
            market: Market.ONE_X_TWO,
            pick: first.pick,
            probability: first.probability,
          }),
          rank: 1,
        },
      ],
    };
  }
}
