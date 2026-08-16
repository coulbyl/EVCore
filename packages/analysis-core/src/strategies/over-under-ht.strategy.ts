import type Decimal from "decimal.js";
import { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { priceForSelection } from "../selection";
import {
  getOverUnderHtLineConfigs,
  type OverUnderHtLine,
  type OverUnderHtLineConfig,
  type OverUnderHtSide,
} from "./config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
  StrategySelection,
} from "./types";
import type { MatchProbabilities } from "../selection/types";

function overUnderHtPick(line: OverUnderHtLine, side: OverUnderHtSide): string {
  return `${side}_${line}`;
}

function overUnderHtProbability(
  probabilities: MatchProbabilities,
  line: OverUnderHtLine,
  side: OverUnderHtSide,
): Decimal | undefined {
  return probabilities.ouHT[
    overUnderHtPick(line, side) as keyof typeof probabilities.ouHT
  ];
}

type OverUnderHtCandidate = {
  config: OverUnderHtLineConfig;
  pick: string;
  probability: Decimal;
  priced: ReturnType<typeof priceForSelection>;
};

// Rank value-first (EV when priced), same tiebreak as GoalsStrategy/TeamTotalStrategy.
function compareOverUnderHtCandidates(
  a: OverUnderHtCandidate,
  b: OverUnderHtCandidate,
): number {
  const aEv = a.priced.ev ?? null;
  const bEv = b.priced.ev ?? null;
  if (aEv !== null && bEv !== null) return bEv.comparedTo(aEv);
  if (aEv !== null) return -1;
  if (bEv !== null) return 1;
  return b.probability.comparedTo(a.probability);
}

// Pure OVER_UNDER_HT decision over an explicit set of (already enabled) line
// configs — mirrors decideGoals/decideTeamTotal, single line dimension
// (0.5/1.5), no team split.
export function decideOverUnderHt(
  context: StrategyContext,
  lineConfigs: readonly OverUnderHtLineConfig[],
): StrategyDecision {
  const channel = STRATEGY_CHANNEL.OVER_UNDER_HT;
  // OVER_UNDER_HT is derived from the same half-time decomposition as
  // HALF_TIME_FULL_TIME/FIRST_HALF_WINNER (bivariate Poisson split) and
  // carries the identical overestimation risk in leagues without enough HT
  // history — see SelectionConfig.htftCalibrated and pick-validation.ts'
  // getPickRejectionReason (audit 2026-08-13). VALUE's opportunistic path
  // already enforces this gate; this dedicated channel didn't (found
  // 2026-08-16 while designing FIRST_HALF_WINNER/HALF_TIME_FULL_TIME, which
  // need the identical check).
  if (!context.selectionConfig.htftCalibrated) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "market_suspended",
      selections: [],
    };
  }
  if (lineConfigs.length === 0) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const candidates: OverUnderHtCandidate[] = [];
  let bestBelow: { probability: number; threshold: number } | null = null;
  for (const config of lineConfigs) {
    const probability = overUnderHtProbability(
      context.probabilities,
      config.line,
      config.side,
    );
    if (probability === undefined) continue;
    if (probability.lessThan(config.threshold)) {
      const probabilityNum = probability.toNumber();
      if (bestBelow === null || probabilityNum > bestBelow.probability) {
        bestBelow = {
          probability: probabilityNum,
          threshold: config.threshold,
        };
      }
      continue;
    }
    const pick = overUnderHtPick(config.line, config.side);
    candidates.push({
      config,
      pick,
      probability,
      priced: priceForSelection({
        odds: context.odds,
        market: Market.OVER_UNDER_HT,
        pick,
        probability,
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

  candidates.sort(compareOverUnderHtCandidates);
  const best = candidates[0];
  if (!best)
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_candidates",
      selections: [],
    };
  const selection: StrategySelection = {
    market: Market.OVER_UNDER_HT,
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

// OVER_UNDER_HT channel — first-half Over/Under goals line. Like GOALS,
// evaluates every enabled (line × side) config for the league and emits the
// single best one (by EV). OBSERVATION mode, no backtested segments yet —
// see config.ts header.
export class OverUnderHtStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.OVER_UNDER_HT;
  readonly allowedMarkets: readonly Market[] = [Market.OVER_UNDER_HT];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideOverUnderHt(
      context,
      getOverUnderHtLineConfigs(context.competitionCode),
    );
  }
}
