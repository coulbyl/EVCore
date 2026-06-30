import Decimal from "decimal.js";
import type { Market, StrategyChannel } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { AVOID_CONFIG } from "./config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";

type AvoidOffender = {
  channel: StrategyChannel;
  market: Market;
  pick: string;
  edge: number;
};

// Pure AVOID decision over the phase-1 primary decisions. AVOID emits NO pick —
// it is a negative (publication-gate) decision. When triggered it returns
// SELECTED with empty selections + the offending picks in reasonDetails (the
// "selection" is the avoidance itself); when nothing is suspect it REJECTS.
// A downstream consumer (publication / coupon layer) honours an AVOID SELECTED
// by suppressing the fixture's picks — it does not erase the other channels'
// analytical decisions.
export function decideAvoid(
  context: StrategyContext,
  config: { enabled: boolean; maxEdge: number },
): StrategyDecision {
  const channel = STRATEGY_CHANNEL.AVOID;
  if (!config.enabled) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const offenders: AvoidOffender[] = [];
  for (const [, decision] of context.previousDecisions) {
    if (decision.status !== CHANNEL_DECISION_STATUS.SELECTED) continue;
    for (const sel of decision.selections) {
      if (!sel.odds || sel.odds.lessThanOrEqualTo(1)) continue;
      // Model edge over the market = model probability − implied probability.
      const edge = sel.probability.minus(new Decimal(1).div(sel.odds));
      if (edge.greaterThanOrEqualTo(config.maxEdge)) {
        offenders.push({
          channel: decision.channel,
          market: sel.market,
          pick: sel.pick,
          edge: edge.toNumber(),
        });
      }
    }
  }

  if (offenders.length === 0) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_avoid_signal",
      selections: [],
    };
  }

  return {
    channel,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    reasonCode: "extreme_divergence",
    reasonDetails: { maxEdge: config.maxEdge, offenders },
    selections: [],
  };
}

// AVOID — meta-strategy (orchestrator phase 2). Inspects the phase-1 primary
// selections and flags the fixture for avoidance when a pick shows an
// implausible model↔market divergence (see AVOID_CONFIG). Emits no pick of its
// own; allowedMarkets is empty by design.
export class AvoidStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.AVOID;
  readonly allowedMarkets: readonly Market[] = [];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideAvoid(context, AVOID_CONFIG);
  }
}
