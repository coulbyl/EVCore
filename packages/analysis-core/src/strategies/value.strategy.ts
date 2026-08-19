import Decimal from "decimal.js";
import type { Market } from "../types";
import type { ViablePick } from "../selection/types";
import { bestQualityPickDetails } from "../selection";
import {
  LINE_MOVEMENT_THRESHOLD,
  VALUE_MIN_EDGE,
} from "../selection/constants";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";
import {
  PHASE2_FILTER_MARKETS,
  viablePicksFromPreviousDecisions,
} from "./filter-candidates";

// VALUE — Phase 2 filter (docs/prediction-engine-families.md §0, docs/
// channel-strategy-architecture.md §5). Moved out of Phase 1 on 2026-08-18:
// it no longer scans the full evaluated-markets pool on its own — it picks
// the best edge among the picks the Phase-1 market specialists already
// selected for their own market. A market with no Phase-1 SELECTED decision
// (channel rejected, disabled, or missing data) contributes no candidate
// here; that's the point, not a gap to patch.
export class ValueStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.VALUE;
  readonly allowedMarkets = PHASE2_FILTER_MARKETS;

  evaluate(context: StrategyContext): StrategyDecision {
    const ch = this.channel;

    if (context.odds === null) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.MISSING_ODDS,
        selections: [],
      };
    }

    if (context.deterministicScore.lessThan(context.modelScoreThreshold)) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: "score_below_threshold",
        reasonDetails: {
          score: context.deterministicScore.toNumber(),
          threshold: context.modelScoreThreshold.toNumber(),
        },
        selections: [],
      };
    }

    // Only markets a Phase-1 specialist actually SELECTED, priced (DRAW's
    // picks carry no odds by design — see StrategySelection's comment in
    // strategies/types.ts — and are naturally excluded here).
    const candidates = viablePicksFromPreviousDecisions(
      context.previousDecisions,
      PHASE2_FILTER_MARKETS,
      context.deterministicScore,
    );

    const minEdge = context.selectionConfig.valueMinEdge ?? VALUE_MIN_EDGE;
    const best = selectBestEdgePick(
      candidates,
      minEdge,
      context.selectionConfig.valueMarketTrust,
    );

    if (best === null) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: "no_viable_pick",
        // What the best-quality specialist-vetted candidate looked like,
        // even though it didn't clear the edge floor — closes the audit gap
        // ("what would VALUE have picked") without re-deriving anything.
        reasonDetails: bestQualityPickDetails(candidates),
        selections: [],
      };
    }

    if (
      context.signals.lineMovement !== null &&
      context.signals.lineMovement > LINE_MOVEMENT_THRESHOLD.toNumber()
    ) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: "line_movement",
        reasonDetails: { movement: context.signals.lineMovement },
        selections: [],
      };
    }

    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.SELECTED,
      selections: [
        {
          market: best.market,
          pick: best.pick,
          probability: best.probability,
          odds: best.odds,
          ev: best.ev,
          qualityScore: best.qualityScore,
          rank: 1,
        },
      ],
    };
  }
}

// Best edge (probability − 1/odds) among specialist-vetted candidates, tie-
// broken by qualityScore × marketTrust. Simpler than the old evaluatedMarkets-
// era selectBestEvPick: every candidate here already passed a Phase-1
// channel's own thresholds, so there's no "best candidate was rejected by an
// internal gate, fall back to a lesser one" case left to handle — that
// fallback only made sense when scanning a raw pool that included rejected
// picks.
//
// marketTrust (2026-08-19, db:backtest:market-trust-calibration): comparing
// raw qualityScore across 17 markets of very different calibration
// reliability lets the worst-calibrated markets win the argmax precisely
// because their noise is largest, not because they're genuinely the best
// pick (winner's curse — audit of the replay complet found VALUE's edge
// floor alone doesn't fix this: no edge ceiling improved ROI at any
// threshold, but per-market ROI ranged from +23% to -76%). Discounting
// qualityScore by each market's measured reliability before ranking fixes
// the comparison without excluding any market outright (feedback_fix_not_
// disable) — undefined resolver ⇒ trust=1 (identity, pre-2026-08-19
// behavior) for every caller that hasn't wired the config yet.
function selectBestEdgePick(
  picks: ViablePick[],
  minEdge: Decimal,
  marketTrust?: (market: Market) => Decimal,
): ViablePick | null {
  const viable = picks
    .filter((p) =>
      p.probability
        .minus(new Decimal(1).div(p.odds))
        .greaterThanOrEqualTo(minEdge),
    )
    .sort((a, b) =>
      b.qualityScore
        .times(marketTrust?.(b.market) ?? 1)
        .comparedTo(a.qualityScore.times(marketTrust?.(a.market) ?? 1)),
    );

  return viable[0] ?? null;
}
