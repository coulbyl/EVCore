import Decimal from "decimal.js";
import { Market } from "../types";
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
import { viablePicksFromPreviousDecisions } from "./filter-candidates";

// Must mirror every market listEvaluatedPicks() (selection/pick-evaluation.ts)
// can emit a candidate for — the orchestrator rejects any VALUE selection on
// a market outside this list (see orchestrator.ts's allowedMarkets check).
const ALL_MARKETS: readonly Market[] = [
  Market.ONE_X_TWO,
  Market.OVER_UNDER,
  Market.BTTS,
  Market.DOUBLE_CHANCE,
  Market.HALF_TIME_FULL_TIME,
  Market.OVER_UNDER_HT,
  Market.FIRST_HALF_WINNER,
  Market.DRAW_NO_BET,
  Market.TEAM_TOTAL_HOME,
  Market.TEAM_TOTAL_AWAY,
  Market.CLEAN_SHEET_HOME,
  Market.CLEAN_SHEET_AWAY,
  Market.WIN_TO_NIL_HOME,
  Market.WIN_TO_NIL_AWAY,
  Market.TO_WIN_EITHER_HALF,
  Market.RESULT_TOTAL_GOALS,
  Market.RESULT_BTTS,
];

// VALUE — Phase 2 filter (docs/prediction-engine-families.md §0, docs/
// channel-strategy-architecture.md §5). Moved out of Phase 1 on 2026-08-18:
// it no longer scans the full evaluated-markets pool on its own — it picks
// the best edge among the picks the Phase-1 market specialists already
// selected for their own market. A market with no Phase-1 SELECTED decision
// (channel rejected, disabled, or missing data) contributes no candidate
// here; that's the point, not a gap to patch.
export class ValueStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.VALUE;
  readonly allowedMarkets = ALL_MARKETS;

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
      ALL_MARKETS,
      context.deterministicScore,
    );

    const minEdge = context.selectionConfig.valueMinEdge ?? VALUE_MIN_EDGE;
    const best = selectBestEdgePick(candidates, minEdge);

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
// broken by qualityScore. Simpler than the old evaluatedMarkets-era
// selectBestEvPick: every candidate here already passed a Phase-1 channel's
// own thresholds, so there's no "best candidate was rejected by an internal
// gate, fall back to a lesser one" case left to handle — that fallback only
// made sense when scanning a raw pool that included rejected picks.
function selectBestEdgePick(
  picks: ViablePick[],
  minEdge: Decimal,
): ViablePick | null {
  const viable = picks
    .filter((p) =>
      p.probability
        .minus(new Decimal(1).div(p.odds))
        .greaterThanOrEqualTo(minEdge),
    )
    .sort((a, b) => b.qualityScore.comparedTo(a.qualityScore));

  return viable[0] ?? null;
}
