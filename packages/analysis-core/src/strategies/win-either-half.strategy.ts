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

type WinEitherHalfCandidate = { pick: "HOME" | "AWAY"; probability: Decimal };

// Pure WIN_EITHER_HALF decision over an explicit config — kept separate from
// the class so it can be tested without the module-level per-league config
// (every prod segment starts disabled pending a backtest pass).
export function decideWinEitherHalf(
  context: StrategyContext,
  config: ChannelStrategyLeagueConfig,
): StrategyDecision {
  const ch = STRATEGY_CHANNEL.WIN_EITHER_HALF;
  if (!config.enabled) {
    return { channel: ch, status: CHANNEL_DECISION_STATUS.DISABLED, selections: [] };
  }

  const { winEitherHalfHome, winEitherHalfAway } = context.probabilities;
  const allCandidates: WinEitherHalfCandidate[] = [
    { pick: "HOME", probability: winEitherHalfHome },
    { pick: "AWAY", probability: winEitherHalfAway },
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
        winEitherHalfHome: winEitherHalfHome.toNumber(),
        winEitherHalfAway: winEitherHalfAway.toNumber(),
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
        market: Market.TO_WIN_EITHER_HALF,
        pick: best.pick,
        probability: best.probability,
        ...priceForSelection({
          odds: context.odds,
          market: Market.TO_WIN_EITHER_HALF,
          pick: best.pick,
          probability: best.probability,
        }),
        rank: 1,
      },
    ],
  };
}

// WIN_EITHER_HALF — a team can win the match without winning either half
// outright (e.g. lose H1 then win H2 big), so this is a distinct "constancy"
// signal from ONE_X_TWO/DOMINANT, not a derivative of it. Single market
// (TO_WIN_EITHER_HALF), argmax between HOME/AWAY above threshold.
export class WinEitherHalfStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.WIN_EITHER_HALF;
  readonly allowedMarkets: readonly Market[] = [Market.TO_WIN_EITHER_HALF];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideWinEitherHalf(
      context,
      getChannelStrategyConfig("WIN_EITHER_HALF", context.competitionCode),
    );
  }
}
