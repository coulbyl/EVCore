import type Decimal from "decimal.js";
import { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { priceForSelection } from "../selection";
import { getDrawNoBetConfig } from "./config";
import type { ChannelStrategyLeagueConfig } from "./config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";

type DrawNoBetCandidate = { pick: "HOME" | "AWAY"; probability: Decimal };

// Pure DRAW_NO_BET decision over an explicit config — mirrors decideCleanSheet:
// evaluate both sides against a shared threshold, take the argmax above it.
// dnbHome/dnbAway are complementary (sum to 1), so whichever side clears a
// >0.5 threshold is unambiguous — no need to pre-select a side per league.
export function decideDrawNoBet(
  context: StrategyContext,
  config: ChannelStrategyLeagueConfig,
): StrategyDecision {
  const channel = STRATEGY_CHANNEL.DRAW_NO_BET;
  if (!config.enabled) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const { dnbHome, dnbAway } = context.probabilities;
  const allCandidates: readonly DrawNoBetCandidate[] = [
    { pick: "HOME", probability: dnbHome },
    { pick: "AWAY", probability: dnbAway },
  ];
  const candidates = allCandidates.filter(
    (c) => !c.probability.lessThan(config.threshold),
  );

  if (candidates.length === 0) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "below_threshold",
      reasonDetails: {
        dnbHome: dnbHome.toNumber(),
        dnbAway: dnbAway.toNumber(),
        threshold: config.threshold,
      },
      selections: [],
    };
  }

  const best = candidates.reduce((a, b) =>
    b.probability.greaterThan(a.probability) ? b : a,
  );

  return {
    channel,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    selections: [
      {
        market: Market.DRAW_NO_BET,
        pick: best.pick,
        probability: best.probability,
        ...priceForSelection({
          odds: context.odds,
          market: Market.DRAW_NO_BET,
          pick: best.pick,
          probability: best.probability,
        }),
        rank: 1,
      },
    ],
  };
}

// DRAW_NO_BET channel — derived two-way market (draw refunded). Argmax
// between HOME/AWAY above threshold, same pattern as CleanSheetStrategy.
// OBSERVATION mode, no backtested segments yet — see config.ts header.
export class DrawNoBetStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.DRAW_NO_BET;
  readonly allowedMarkets: readonly Market[] = [Market.DRAW_NO_BET];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideDrawNoBet(
      context,
      getDrawNoBetConfig(context.competitionCode),
    );
  }
}
