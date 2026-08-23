import type Decimal from "decimal.js";
import type { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { bestQualityPickDetails, buildBetPickKey } from "../selection";
import type { ViablePick } from "../selection/types";
import {
  EV_HARD_CAP,
  LINE_MOVEMENT_THRESHOLD,
  SAFE_VALUE_MAX_ODDS,
  SAFE_VALUE_MIN_EV,
} from "../selection/constants";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";
import {
  PHASE2_FILTER_MARKETS,
  viablePicksFromPreviousDecisions,
} from "./filter-candidates";

// SAFE — Phase 2 filter (docs/prediction-engine-families.md §0, docs/
// channel-strategy-architecture.md §5). Moved out of Phase 1 on 2026-08-18:
// same principle as VALUE — selects among the Phase-1 market specialists'
// own picks, never scans evaluatedMarkets on its own.
//
// Widened from a 4-market list (ONE_X_TWO/OVER_UNDER/BTTS/OVER_UNDER_HT) to
// every VALUE market on 2026-08-19 (explicit product decision: SAFE should
// be able to draw its high-probability/low-odds pick from any market, not
// just four). selectEligibleSafeCandidate below accepts the same marketTrust
// ranking-discount hook as VALUE's selectBestEdgePick, but no app config
// wires it yet: db:backtest:market-trust-calibration validated VALUE's
// weights (+0.86pp ROI out-of-sample) but a SAFE-specific measurement only
// reached -0.04pp (noise-level, not a real improvement) — SAFE's eligible
// pool (probability≥0.68 AND ev/odds-bounded) is narrow enough that
// discounting rarely changes which candidate wins. Revisit once the newer
// markets (WIN_TO_NIL/CLEAN_SHEET/etc., ~1 month old) accumulate more
// SAFE-eligible volume.
//
// Known, deliberate simplification vs. the pre-2026-08-18 version: the old
// SAFE additionally compared its winning UNDER pick against OVER
// counterparts at high total lambda (SV_UNDER_LAMBDA_COMPARISON_THRESHOLD) —
// a refinement that needed several OVER_UNDER lines simultaneously, which a
// single specialist channel (GOALS picks exactly one line) can't provide
// through previousDecisions. Dropped rather than special-cased back onto the
// raw pool — revisit during the calibration pass (ROADMAP.md, "Audit de
// calibration par marché × ligue") if dropping it measurably hurts SAFE's
// ROI.
export class SafeStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.SAFE;
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

    const evDecision = context.previousDecisions.get(STRATEGY_CHANNEL.VALUE);
    const evSel = evDecision?.selections[0];
    const evPickKey = evSel
      ? buildBetPickKey({ market: evSel.market, pick: evSel.pick })
      : null;

    const candidates = viablePicksFromPreviousDecisions(
      context.previousDecisions,
      PHASE2_FILTER_MARKETS,
      context.deterministicScore,
    );

    const best = selectEligibleSafeCandidate(candidates, {
      suspendedMarkets: context.signals.suspendedMarkets,
      excludedPickKey: evPickKey,
      svMinProbability: context.selectionConfig.svMinProbability,
      svMinOdds: context.selectionConfig.svMinOdds,
      marketTrust: context.selectionConfig.safeMarketTrust,
    });

    if (best === null) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: "no_safe_candidate",
        reasonDetails: bestQualityPickDetails(candidates),
        selections: [],
      };
    }

    // Same fixture-level adverse-drift guard as ValueStrategy (rapport-dev
    // 2026-07-09, point #2): SAFE is staked and previously had no
    // line-movement check at all.
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

function selectEligibleSafeCandidate(
  picks: ViablePick[],
  opts: {
    suspendedMarkets: ReadonlySet<Market>;
    excludedPickKey: string | null;
    svMinProbability: Decimal;
    svMinOdds: Decimal;
    marketTrust?: (market: Market) => Decimal;
  },
): ViablePick | null {
  const {
    suspendedMarkets,
    excludedPickKey,
    svMinProbability,
    svMinOdds,
    marketTrust,
  } = opts;

  const eligible = picks.filter((pick) => {
    if (pick.probability.lessThan(svMinProbability)) return false;
    if (pick.ev.lessThan(SAFE_VALUE_MIN_EV)) return false;
    if (pick.ev.greaterThan(EV_HARD_CAP)) return false;
    if (pick.odds.lessThan(svMinOdds)) return false;
    if (pick.odds.greaterThan(SAFE_VALUE_MAX_ODDS)) return false;
    if (suspendedMarkets.has(pick.market)) return false;
    const pickKey = buildBetPickKey({ market: pick.market, pick: pick.pick });
    if (excludedPickKey !== null && pickKey === excludedPickKey) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  // Best by (probability × marketTrust) DESC, then (EV × marketTrust) DESC —
  // same ranking as the pre-2026-08-18 selectSafeValuePick, with the
  // eligibility gates above (svMinProbability etc.) still reading the real
  // probability/EV unmodified — marketTrust only discounts the RANKING
  // comparison between markets of different calibration reliability, the
  // same role it plays in ValueStrategy.selectBestEdgePick. Undefined
  // resolver ⇒ trust=1 (identity), matching SAFE's original 4-market
  // ranking exactly.
  return eligible.reduce((best, c) => {
    const trustC = marketTrust?.(c.market) ?? 1;
    const trustBest = marketTrust?.(best.market) ?? 1;
    const cmpProb = c.probability
      .times(trustC)
      .comparedTo(best.probability.times(trustBest));
    if (cmpProb > 0) return c;
    if (cmpProb < 0) return best;
    return c.ev.times(trustC).comparedTo(best.ev.times(trustBest)) > 0
      ? c
      : best;
  });
}
