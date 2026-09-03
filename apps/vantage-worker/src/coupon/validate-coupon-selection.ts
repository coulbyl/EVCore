import {
  calculateEV,
  clearsMaxLegEdge,
  clearsMinLegOdds,
  clearsTeamTotalMaxOdds,
  clearsValueEdgeFloor,
  createAntiCorrelationState,
  legProbability,
  recordAntiCorrelation,
  violatesAntiCorrelation,
  type CouponBounds,
  type CouponClass,
} from "@evcore/analysis-core";
import type { SelectedLeg } from "./generate-coupon-selection";

// Phase C (docs/vantage-centric-redesign-2026-09-01.md §9 point 4):
// deterministic post-generation validation, never trusting the LLM's own
// selection at face value. Everything the prompt TOLD the model about
// (anti-correlation, leg-odds band, target odds) is re-checked here in
// code — a prompt is not a hard constraint, and every leg the LLM picked
// already cleared these gates once inside score-candidates.ts's
// admissibleCandidates BEFORE the model ever saw it, so this is defense in
// depth, not the only line of defense.

const MIN_DISTINCT_FIXTURES = 2;

export type ComposedCoupon = {
  legs: readonly SelectedLeg[];
  combinedOdds: number;
  /** Produit brut des probas par jambe, avant toute correction éventuelle —
   * voir jointProbability. */
  rawJointProbability: number;
  jointProbability: number;
  couponEV: number;
};

export type ValidateCouponSelectionResult =
  | { outcome: "valid"; coupon: ComposedCoupon }
  | { outcome: "rejected"; reason: string };

function legLabel(leg: SelectedLeg): string {
  const { fixtureId, market, pick } = leg.candidate;
  return `${fixtureId}/${market}/${pick}`;
}

export function validateCouponSelection(
  selectedLegs: readonly SelectedLeg[],
  couponClass: CouponClass,
  bounds: CouponBounds,
): ValidateCouponSelectionResult {
  if (
    selectedLegs.length < bounds.minLegs ||
    selectedLegs.length > couponClass.maxLegs
  ) {
    return {
      outcome: "rejected",
      reason: `${selectedLegs.length} legs is outside [${bounds.minLegs}, ${couponClass.maxLegs}] for class ${couponClass.name}`,
    };
  }

  const distinctFixtures = new Set(
    selectedLegs.map((l) => l.candidate.fixtureId),
  );
  if (distinctFixtures.size < MIN_DISTINCT_FIXTURES) {
    return {
      outcome: "rejected",
      reason: `only ${distinctFixtures.size} distinct fixture(s) selected, need at least ${MIN_DISTINCT_FIXTURES}`,
    };
  }

  for (const leg of selectedLegs) {
    const { candidate } = leg;
    if (candidate.oddsSnapshot === null) {
      return {
        outcome: "rejected",
        reason: `leg ${legLabel(leg)} has no real odds`,
      };
    }
    if (!clearsValueEdgeFloor(candidate)) {
      return {
        outcome: "rejected",
        reason: `leg ${legLabel(leg)} fails the VALUE edge floor`,
      };
    }
    if (!clearsTeamTotalMaxOdds(candidate)) {
      return {
        outcome: "rejected",
        reason: `leg ${legLabel(leg)} exceeds the TEAM_TOTAL odds ceiling`,
      };
    }
    if (!clearsMaxLegEdge(candidate)) {
      return {
        outcome: "rejected",
        reason: `leg ${legLabel(leg)} exceeds the max model-market edge`,
      };
    }
    if (
      !clearsMinLegOdds(candidate, {
        minLegOdds: couponClass.minLegOdds,
        maxLegOdds: couponClass.maxLegOdds,
      })
    ) {
      return {
        outcome: "rejected",
        reason: `leg ${legLabel(leg)} is outside the ${couponClass.name} leg-odds band [${couponClass.minLegOdds}, ${couponClass.maxLegOdds})`,
      };
    }
  }

  const state = createAntiCorrelationState([]);
  const accepted: SelectedLeg[] = [];
  for (const leg of selectedLegs) {
    if (
      violatesAntiCorrelation(
        accepted.map((l) => l.candidate),
        leg.candidate,
        { state },
      )
    ) {
      return {
        outcome: "rejected",
        reason: `leg ${legLabel(leg)} violates anti-correlation (shares a fixture, a canal+market, or exceeds the 2-per-competition cap with another selected leg)`,
      };
    }
    recordAntiCorrelation(state, leg.candidate);
    accepted.push(leg);
  }

  const combinedOdds = selectedLegs.reduce(
    (acc, l) => acc * (l.candidate.oddsSnapshot as number),
    1,
  );
  if (
    combinedOdds < bounds.minCombinedOdds ||
    combinedOdds > bounds.maxCombinedOdds
  ) {
    return {
      outcome: "rejected",
      reason: `combined odds ${combinedOdds.toFixed(2)} outside the product-safety bounds [${bounds.minCombinedOdds}, ${bounds.maxCombinedOdds}]`,
    };
  }
  // Same discipline as the retired composer's buildOne(): a target is a
  // publish gate, never a soft aim — better no coupon for this class today
  // than one that quietly misses its own stated target odds.
  if (combinedOdds < couponClass.targetCombinedOdds) {
    return {
      outcome: "rejected",
      reason: `combined odds ${combinedOdds.toFixed(2)} below the ${couponClass.name} target of ${couponClass.targetCombinedOdds}`,
    };
  }

  // No coupon-level correction on top of the per-leg calibrated
  // probabilities — three were tried and measured worse than the plain
  // product (see MAX_LEG_EDGE's doc comment, guardrails.ts) — kept as a
  // distinct field from jointProbability only so a future correction has
  // somewhere to land without renaming anything.
  const rawJointProbability = selectedLegs.reduce(
    (acc, l) => acc * legProbability(l.candidate),
    1,
  );
  const jointProbability = rawJointProbability;
  const couponEV = calculateEV(jointProbability, combinedOdds).toNumber();

  return {
    outcome: "valid",
    coupon: {
      legs: selectedLegs,
      combinedOdds,
      rawJointProbability,
      jointProbability,
      couponEV,
    },
  };
}
