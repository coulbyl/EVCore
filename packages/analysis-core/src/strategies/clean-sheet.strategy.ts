import Decimal from "decimal.js";
import { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { priceForSelection } from "../selection";
import { getChannelStrategyConfig } from "./config";
import type { ChannelStrategyLeagueConfig } from "./config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";

type CleanSheetCandidate = { market: Market; probability: Decimal };

// Pure CLEAN_SHEET decision over an explicit config — kept separate from the
// class so it can be tested without the module-level per-league config
// (every prod segment starts disabled pending a backtest pass, same as
// GOALS/TEAM_TOTAL).
export function decideCleanSheet(
  context: StrategyContext,
  config: ChannelStrategyLeagueConfig,
): StrategyDecision {
  const ch = STRATEGY_CHANNEL.CLEAN_SHEET;
  if (!config.enabled) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const { cleanSheetHome, cleanSheetAway } = context.probabilities;
  const candidates: CleanSheetCandidate[] = [
    { market: Market.CLEAN_SHEET_HOME, probability: cleanSheetHome },
    { market: Market.CLEAN_SHEET_AWAY, probability: cleanSheetAway },
  ].filter((c) => !c.probability.lessThan(config.threshold));

  if (candidates.length === 0) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "below_threshold",
      reasonDetails: {
        cleanSheetHome: cleanSheetHome.toNumber(),
        cleanSheetAway: cleanSheetAway.toNumber(),
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
        market: best.market,
        pick: "YES",
        probability: best.probability,
        ...priceForSelection({
          odds: context.odds,
          market: best.market,
          pick: "YES",
          probability: best.probability,
        }),
        rank: 1,
      },
    ],
  };
}

// CLEAN_SHEET — defensive signal orthogonal to BTTS/ONE_X_TWO: does a single
// team keep a clean sheet? Two independent markets (CLEAN_SHEET_HOME/AWAY),
// argmax between sides above threshold, same pattern as BttsStrategy.
export class CleanSheetStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.CLEAN_SHEET;
  readonly allowedMarkets: readonly Market[] = [
    Market.CLEAN_SHEET_HOME,
    Market.CLEAN_SHEET_AWAY,
  ];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideCleanSheet(
      context,
      getChannelStrategyConfig("CLEAN_SHEET", context.competitionCode),
    );
  }
}
