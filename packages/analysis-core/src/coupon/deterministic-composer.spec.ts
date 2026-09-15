import { describe, expect, it } from "vitest";
import {
  DETERMINISTIC_COUPON_POLICY_VERSION,
  UNIFIED_COUPON_BOUNDS,
  UNIFIED_COUPON_CLASS,
} from "./coupon-classes";
import {
  buildDeterministicCandidatePool,
  composeDeterministicCoupon,
} from "./deterministic-composer";
import type { CouponLeg } from "./guardrails";

function candidate(id: string, overrides: Partial<CouponLeg> = {}): CouponLeg {
  return {
    fixtureId: id,
    canal: `CHANNEL_${id}`,
    market: `MARKET_${id}`,
    pick: `PICK_${id}`,
    competition: `COMP_${id}`,
    dayBucket: "2026-09-15",
    probability: 0.5,
    calibratedHitRate: 0.5,
    calibratedProbability: 0.5,
    oddsSnapshot: 2.2,
    referenceOdds: 2,
    featureSnapshot: {},
    offensiveBalance: null,
    shadowConflict: null,
    priorAnalysisCount: 0,
    ...overrides,
  };
}

describe("composeDeterministicCoupon", () => {
  it("uses a distinct policy version while the LLM policy remains active", () => {
    expect(DETERMINISTIC_COUPON_POLICY_VERSION).toBe("deterministic-5-7-v1");
  });

  it("returns exactly the same coupon regardless of input order", () => {
    const candidates = [
      candidate("a", {
        calibratedProbability: 0.57,
        probability: 0.57,
        calibratedHitRate: 0.57,
        oddsSnapshot: 2.1,
        referenceOdds: 1.9,
      }),
      candidate("b", {
        calibratedProbability: 0.48,
        probability: 0.48,
        calibratedHitRate: 0.48,
        oddsSnapshot: 2.4,
        referenceOdds: 2.2,
      }),
      candidate("c", {
        calibratedProbability: 0.45,
        probability: 0.45,
        calibratedHitRate: 0.45,
        oddsSnapshot: 2.5,
        referenceOdds: 2.3,
      }),
    ];

    const forward = composeDeterministicCoupon(
      candidates,
      UNIFIED_COUPON_CLASS,
      UNIFIED_COUPON_BOUNDS,
    );
    const reversed = composeDeterministicCoupon(
      [...candidates].reverse(),
      UNIFIED_COUPON_CLASS,
      UNIFIED_COUPON_BOUNDS,
    );

    expect(forward).toEqual(reversed);
    expect(forward.outcome).toBe("composed");
    if (forward.outcome !== "composed") return;
    expect(forward.coupon.legs.map((leg) => leg.fixtureId)).toEqual(["a", "b"]);
    expect(forward.coupon.combinedOdds).toBeCloseTo(5.04, 10);
    expect(forward.coupon.jointProbability).toBeCloseTo(0.2736, 10);
    expect(forward.coupon.couponEV).toBeGreaterThan(0);
  });

  it("returns empty_pool when fewer than two candidates pass admission", () => {
    expect(
      composeDeterministicCoupon(
        [candidate("only")],
        UNIFIED_COUPON_CLASS,
        UNIFIED_COUPON_BOUNDS,
      ),
    ).toEqual({ outcome: "empty_pool" });
  });

  it("abstains when five admissible legs cannot reach combined odds 5", () => {
    const candidates = Array.from({ length: 6 }, (_, index) =>
      candidate(String(index), {
        calibratedProbability: 0.79,
        probability: 0.79,
        calibratedHitRate: 0.79,
        oddsSnapshot: 1.3,
        referenceOdds: 1.3,
      }),
    );
    expect(
      composeDeterministicCoupon(
        candidates,
        UNIFIED_COUPON_CLASS,
        UNIFIED_COUPON_BOUNDS,
      ),
    ).toEqual({ outcome: "no_coupon", reason: "no_admissible_combination" });
  });

  it("deduplicates the same wager before composition", () => {
    const duplicate = candidate("same");
    const pool = buildDeterministicCandidatePool(
      [duplicate, { ...duplicate }],
      UNIFIED_COUPON_CLASS,
    );
    expect(pool).toHaveLength(1);
  });

  it("supports a stricter positive-edge ceiling as part of the pure policy", () => {
    const highEdge = candidate("high-edge", {
      calibratedProbability: 0.55,
      probability: 0.55,
      calibratedHitRate: 0.55,
      oddsSnapshot: 2.2,
      referenceOdds: 2,
    });
    expect(
      buildDeterministicCandidatePool([highEdge], UNIFIED_COUPON_CLASS, {
        maxPositiveEdge: 0.075,
      }),
    ).toHaveLength(1);
    expect(
      buildDeterministicCandidatePool([highEdge], UNIFIED_COUPON_CLASS, {
        maxPositiveEdge: 0.04,
      }),
    ).toHaveLength(0);
  });
});
