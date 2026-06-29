import Decimal from "decimal.js";
import { Market, type StrategyChannel } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { priceForSelection } from "../selection";
import { CONSENSUS_CONFIG } from "./config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
  StrategySelection,
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

  const selection: StrategySelection = {
    market: Market.ONE_X_TWO,
    pick: best.pick,
    probability: best.maxProbability,
    ...priceForSelection({
      odds: context.odds,
      market: Market.ONE_X_TWO,
      pick: best.pick,
      probability: best.maxProbability,
    }),
    qualityScore: new Decimal(best.classes.size),
    rank: 1,
  };

  return {
    channel,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    reasonCode: "consensus",
    reasonDetails: {
      level: best.classes.size,
      classes: [...best.classes],
      channels: best.channels,
    },
    selections: [selection],
  };
}

// CONSENSUS — meta-strategy (orchestrator phase 2). Reads the phase-1 primary
// decisions and emits a 1X2 selection only when ≥ minLevel independent strategy
// classes converge on the same pick. Calibrated globally (see CONSENSUS_CONFIG).
export class ConsensusStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.CONSENSUS;
  readonly allowedMarkets: readonly Market[] = [Market.ONE_X_TWO];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideConsensus(context, CONSENSUS_CONFIG);
  }
}
