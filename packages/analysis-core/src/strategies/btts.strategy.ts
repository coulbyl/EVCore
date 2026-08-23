import Decimal from "decimal.js";
import { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { priceForSelection } from "../selection";
import { getChannelStrategyConfig } from "./channel-strategy.config";
import type { ChannelStrategyLeagueConfig } from "./channel-strategy-config.types";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";

type BttsCandidate = { pick: "YES" | "NO"; probability: Decimal };

// Pure BTTS decision over an explicit config — kept separate from the class
// so it can be tested without the module-level per-league config, same
// pattern as decideCleanSheet/decideWinToNil. One question, one config:
// bttsYes and bttsNo are evaluated against the SAME threshold, argmax picks
// whichever side clears it with the higher probability.
export function decideBtts(
  context: StrategyContext,
  config: ChannelStrategyLeagueConfig,
): StrategyDecision {
  const ch = STRATEGY_CHANNEL.BTTS;
  if (!config.enabled) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const { bttsYes, bttsNo } = context.probabilities;
  const allCandidates: BttsCandidate[] = [
    { pick: "YES", probability: bttsYes },
    { pick: "NO", probability: bttsNo },
  ];
  const candidates = allCandidates.filter(
    (c) => !c.probability.lessThan(config.threshold),
  );

  if (candidates.length === 0) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "below_threshold",
      reasonDetails: {
        bttsYes: bttsYes.toNumber(),
        bttsNo: bttsNo.toNumber(),
        threshold: config.threshold,
      },
      selections: [],
    };
  }

  const best = candidates.reduce((a, b) =>
    b.probability.greaterThan(a.probability) ? b : a,
  );

  return {
    channel: ch,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    selections: [
      {
        market: Market.BTTS,
        pick: best.pick,
        probability: best.probability,
        ...priceForSelection({
          odds: context.odds,
          market: Market.BTTS,
          pick: best.pick,
          probability: best.probability,
        }),
        rank: 1,
      },
    ],
  };
}

// BTTS — will both teams score? Two independent markets (YES/NO), argmax
// between sides above threshold, same pattern as CleanSheetStrategy.
export class BttsStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.BTTS;
  readonly allowedMarkets: readonly Market[] = [Market.BTTS];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideBtts(
      context,
      getChannelStrategyConfig("BTTS", context.competitionCode),
    );
  }
}
