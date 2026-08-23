import Decimal from "decimal.js";
import { Market, type StrategyChannel } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { CONSENSUS_CONFIG } from "./consensus.config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";

// Independence classes for the primary channels. Two strategies in the same
// class lean on the same underlying signal, so they count as ONE vote — the
// consensus level is the number of distinct classes that agree, not the raw
// channel count (channel-strategy-architecture doc §CONSENSUS).
const INDEPENDENCE_CLASS: Partial<Record<StrategyChannel, string>> = {
  DOMINANT: "directional", // model argmax(1X2)
  VALUE: "value", // model prob × odds
  SAFE: "value", // high-confidence value (mutually exclusive with VALUE)
  DRAW: "market_draw", // bookmaker implied draw probability
  BTTS: "goals",
  GOALS: "goals",
};

type PickAgreement = {
  pick: string;
  classes: Set<string>;
  channels: StrategyChannel[];
  maxProbability: Decimal;
};

// Pure CONSENSUS decision over the phase-1 primary decisions. Kept separate from
// the class so it is testable with hand-built decision maps.
export function decideConsensus(
  context: StrategyContext,
  config: { enabled: boolean; minLevel: number },
): StrategyDecision {
  const channel = STRATEGY_CHANNEL.CONSENSUS;
  if (!config.enabled) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  // Tally distinct independence classes agreeing on each 1X2 pick (v1 scope).
  const byPick = new Map<string, PickAgreement>();
  for (const [, decision] of context.previousDecisions) {
    if (decision.status !== CHANNEL_DECISION_STATUS.SELECTED) continue;
    const cls = INDEPENDENCE_CLASS[decision.channel];
    if (!cls) continue;
    for (const sel of decision.selections) {
      if (sel.market !== Market.ONE_X_TWO) continue;
      const entry = byPick.get(sel.pick) ?? {
        pick: sel.pick,
        classes: new Set<string>(),
        channels: [],
        maxProbability: new Decimal(0),
      };
      entry.classes.add(cls);
      entry.channels.push(decision.channel);
      if (sel.probability.greaterThan(entry.maxProbability)) {
        entry.maxProbability = sel.probability;
      }
      byPick.set(sel.pick, entry);
    }
  }

  const agreements = [...byPick.values()];
  const bestLevel = agreements.reduce((m, a) => Math.max(m, a.classes.size), 0);
  if (bestLevel < config.minLevel) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_consensus",
      reasonDetails: { bestLevel, minLevel: config.minLevel },
      selections: [],
    };
  }

  // Best agreement: highest level, tie-break on highest model probability.
  const qualifying = agreements.filter(
    (a) => a.classes.size >= config.minLevel,
  );
  const best = qualifying.reduce((a, b) => {
    if (b.classes.size !== a.classes.size) {
      return b.classes.size > a.classes.size ? b : a;
    }
    return b.maxProbability.greaterThan(a.maxProbability) ? b : a;
  });

  // Emits NO selection (2026-08-22). CONSENSUS is a meta-strategy: it observes
  // that several independent classes agree, it does not originate a pick.
  //
  // It used to publish `{ market: ONE_X_TWO, pick: best.pick, probability:
  // best.maxProbability }`, which was harmful twice over:
  //
  //   1. Pure duplication — all 765 of its settled selections matched another
  //      channel's on the same model run, same market, same pick, same
  //      probability to 4 decimals. Downstream (coupon pool, calibration) it
  //      was the same bet counted twice under a second label.
  //   2. `maxProbability` is the MAXIMUM over the agreeing channels, and the
  //      max of k noisy estimates is biased upward by construction. That alone
  //      explains why CONSENSUS measured a realised/announced ratio of 0.726
  //      while DOMINANT, one of the channels it aggregates, sat at 0.918. The
  //      agreement signal is real; the probability attached to it was not.
  //
  // The agreement level stays available in reasonDetails for anything that
  // wants to weigh it — the same "signal without staking" shape as the H2H
  // scoreline signal on CORRECT_SCORE.
  return {
    channel,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    reasonCode: "consensus",
    reasonDetails: {
      level: best.classes.size,
      classes: [...best.classes],
      channels: best.channels,
      market: Market.ONE_X_TWO,
      pick: best.pick,
    },
    selections: [],
  };
}

// CONSENSUS — meta-strategy (orchestrator phase 3). Reads the phase-1 primary
// decisions and reports, in reasonDetails, when ≥ minLevel independent strategy
// classes converge on the same 1X2 pick. Emits no selection of its own — see
// decideConsensus. Calibrated globally (see CONSENSUS_CONFIG).
export class ConsensusStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.CONSENSUS;
  readonly allowedMarkets: readonly Market[] = [Market.ONE_X_TWO];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideConsensus(context, CONSENSUS_CONFIG);
  }
}
