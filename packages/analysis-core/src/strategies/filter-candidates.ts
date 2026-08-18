import type Decimal from "decimal.js";
import type { Market, StrategyChannel } from "../types";
import { CHANNEL_DECISION_STATUS } from "../types";
import type { ViablePick } from "../selection/types";
import { buildQualityScore } from "../selection";
import type { StrategyDecision } from "./types";

// Shared by the Phase-2 filter channels (VALUE, SAFE): turns every Phase-1
// market specialist's SELECTED pick into a priced ViablePick, restricted to
// `allowedMarkets`. A channel's REJECTED/DISABLED/MISSING_ODDS decision
// contributes nothing — by design, not an oversight (docs/prediction-engine-
// families.md §0). Picks without a real market price (DRAW's ONE_X_TWO/DRAW
// selection carries no odds — its signal IS the implied probability, see
// strategies/types.ts) are skipped too: a filter that selects by edge/EV has
// nothing to evaluate without a price.
//
// Market-specialist strategies price via priceForSelection (odds/ev only —
// see selection/odds.ts) but never compute qualityScore themselves; that was
// historically a VALUE/SAFE-only concept (ev × deterministicScore ×
// longshot penalty). Computed here instead, once, for every candidate.
export function viablePicksFromPreviousDecisions(
  previousDecisions: ReadonlyMap<StrategyChannel, StrategyDecision>,
  allowedMarkets: readonly Market[],
  deterministicScore: Decimal,
): ViablePick[] {
  const picks: ViablePick[] = [];
  for (const decision of previousDecisions.values()) {
    if (decision.status !== CHANNEL_DECISION_STATUS.SELECTED) continue;
    for (const sel of decision.selections) {
      if (!allowedMarkets.includes(sel.market)) continue;
      if (sel.odds === undefined || sel.ev === undefined) continue;
      picks.push({
        market: sel.market,
        pick: sel.pick,
        probability: sel.probability,
        odds: sel.odds,
        ev: sel.ev,
        qualityScore:
          sel.qualityScore ??
          buildQualityScore(
            sel.ev,
            deterministicScore,
            sel.market,
            sel.pick,
            sel.odds,
          ),
      });
    }
  }
  return picks;
}
