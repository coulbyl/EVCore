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

type WinToNilCandidate = { market: Market; probability: Decimal };

// Pure WIN_TO_NIL decision over an explicit config — mirrors decideCleanSheet
// (two independent per-side markets, argmax above a shared threshold), kept
// separate from the class so it can be tested without the module-level
// per-league config (every prod segment starts disabled pending a backtest
// pass, same as CLEAN_SHEET/WIN_EITHER_HALF).
export function decideWinToNil(
  context: StrategyContext,
  config: ChannelStrategyLeagueConfig,
): StrategyDecision {
  const ch = STRATEGY_CHANNEL.WIN_TO_NIL;
  if (!config.enabled) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const { winToNilHome, winToNilAway } = context.probabilities;
  const candidates: WinToNilCandidate[] = [
    { market: Market.WIN_TO_NIL_HOME, probability: winToNilHome },
    { market: Market.WIN_TO_NIL_AWAY, probability: winToNilAway },
  ].filter((c) => !c.probability.lessThan(config.threshold));

  if (candidates.length === 0) {
    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "below_threshold",
      reasonDetails: {
        winToNilHome: winToNilHome.toNumber(),
        winToNilAway: winToNilAway.toNumber(),
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

// WIN_TO_NIL — defensive+offensive combo signal: does a side win without
// conceding? Two independent markets (WIN_TO_NIL_HOME/AWAY), argmax between
// sides above threshold, same pattern as CleanSheetStrategy.
export class WinToNilStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.WIN_TO_NIL;
  readonly allowedMarkets: readonly Market[] = [
    Market.WIN_TO_NIL_HOME,
    Market.WIN_TO_NIL_AWAY,
  ];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideWinToNil(
      context,
      getChannelStrategyConfig("WIN_TO_NIL", context.competitionCode),
    );
  }
}
