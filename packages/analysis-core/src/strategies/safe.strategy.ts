import { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { buildBetPickKey, selectSafeValuePick } from "../selection";
import { LINE_MOVEMENT_THRESHOLD } from "../selection/constants";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";

const SAFE_MARKETS: readonly Market[] = [
  Market.ONE_X_TWO,
  Market.OVER_UNDER,
  Market.BTTS,
  Market.OVER_UNDER_HT,
];

export class SafeStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.SAFE;
  readonly allowedMarkets = SAFE_MARKETS;

  evaluate(context: StrategyContext): StrategyDecision {
    const ch = this.channel;

    if (context.odds === null) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.MISSING_ODDS,
        selections: [],
      };
    }

    if (context.deterministicScore.lessThan(context.modelScoreThreshold)) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: "score_below_threshold",
        reasonDetails: {
          score: context.deterministicScore.toNumber(),
          threshold: context.modelScoreThreshold.toNumber(),
        },
        selections: [],
      };
    }

    const evDecision = context.previousDecisions.get(STRATEGY_CHANNEL.VALUE);
    const evSel = evDecision?.selections[0];
    const evPickKey = evSel
      ? buildBetPickKey({
          market: evSel.market,
          pick: evSel.pick,
          comboMarket: evSel.comboMarket ?? null,
          comboPick: evSel.comboPick ?? null,
        })
      : null;

    const allPicks = context.evaluatedMarkets.flatMap((m) => m.picks);
    const best = selectSafeValuePick(
      allPicks,
      context.signals.suspendedMarkets,
      evPickKey,
      context.signals.lambdaTotal,
      context.selectionConfig,
    );

    if (best === null) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: "no_safe_candidate",
        selections: [],
      };
    }

    // Same fixture-level adverse-drift guard as ValueStrategy (rapport-dev
    // 2026-07-09, point #2): SAFE is staked and previously had no
    // line-movement check at all.
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
          market: best.market,
          pick: best.pick,
          probability: best.probability,
          odds: best.odds,
          ev: best.ev,
          qualityScore: best.qualityScore,
          rank: 1,
        },
      ],
    };
  }
}
