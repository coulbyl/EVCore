import type Decimal from "decimal.js";
import { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { priceForSelection } from "../selection";
import { DOUBLE_CHANCE_CONFIG } from "./double-chance.config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
  StrategySelection,
} from "./types";

type DoubleChanceCandidate = {
  pick: "1X" | "X2" | "12";
  probability: Decimal;
  priced: ReturnType<typeof priceForSelection>;
};

// Rank value-first (EV when priced), same tiebreak as GoalsStrategy — a
// price-less candidate is never selected (see decideDoubleChance).
function compareDoubleChanceCandidates(
  a: DoubleChanceCandidate,
  b: DoubleChanceCandidate,
): number {
  const aEv = a.priced.ev ?? null;
  const bEv = b.priced.ev ?? null;
  if (aEv !== null && bEv !== null) return bEv.comparedTo(aEv);
  if (aEv !== null) return -1;
  if (bEv !== null) return 1;
  return b.probability.comparedTo(a.probability);
}

// Pure DOUBLE_CHANCE decision. Unlike every other channel here, this reads no
// per-league config: dc1X/dcX2/dc12 are pure linear derivations of the
// already-calibrated 1X2 (dc1X = home+draw, etc — see probability/poisson.ts),
// so there's no new signal to calibrate per league. Same shape as SAFE's
// relationship to VALUE: same underlying probabilities, a safer point on the
// risk/payout curve (cover 2 of 3 outcomes at shorter odds).
export function decideDoubleChance(context: StrategyContext): StrategyDecision {
  const channel = STRATEGY_CHANNEL.DOUBLE_CHANCE;
  if (!DOUBLE_CHANCE_CONFIG.enabled) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const { dc1X, dcX2, dc12 } = context.probabilities;
  const minProbability = DOUBLE_CHANCE_CONFIG.minProbability;
  const raw: Array<{ pick: "1X" | "X2" | "12"; probability: Decimal }> = [
    { pick: "1X", probability: dc1X },
    { pick: "X2", probability: dcX2 },
    { pick: "12", probability: dc12 },
  ];

  const candidates: DoubleChanceCandidate[] = [];
  let bestBelow: { probability: number; threshold: number } | null = null;
  for (const c of raw) {
    if (c.probability.lessThan(minProbability)) {
      const probabilityNum = c.probability.toNumber();
      if (bestBelow === null || probabilityNum > bestBelow.probability) {
        bestBelow = { probability: probabilityNum, threshold: minProbability };
      }
      continue;
    }
    candidates.push({
      pick: c.pick,
      probability: c.probability,
      priced: priceForSelection({
        odds: context.odds,
        market: Market.DOUBLE_CHANCE,
        pick: c.pick,
        probability: c.probability,
      }),
    });
  }

  if (candidates.length === 0) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "below_threshold",
      reasonDetails: bestBelow ?? {},
      selections: [],
    };
  }

  // A price-less pick is never selected — no candidate to rank on without a
  // real double-chance price (same reasoning as GoalsStrategy).
  const priced = candidates.filter((c) => c.priced.odds !== undefined);
  if (priced.length === 0) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_priced_pick",
      reasonDetails: { candidatePicks: candidates.map((c) => c.pick) },
      selections: [],
    };
  }

  priced.sort(compareDoubleChanceCandidates);
  const best = priced[0];
  if (!best)
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_candidates",
      selections: [],
    };
  const selection: StrategySelection = {
    market: Market.DOUBLE_CHANCE,
    pick: best.pick,
    probability: best.probability,
    ...best.priced,
    rank: 1,
  };

  return {
    channel,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    selections: [selection],
  };
}

// DOUBLE_CHANCE channel — covers 2 of 3 full-time outcomes (1X/X2/12) at
// shorter odds. Global conviction floor (no per-league table — see
// decideDoubleChance). OBSERVATION mode, no backtested threshold yet.
export class DoubleChanceStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.DOUBLE_CHANCE;
  readonly allowedMarkets: readonly Market[] = [Market.DOUBLE_CHANCE];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideDoubleChance(context);
  }
}
