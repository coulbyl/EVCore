import { describe, expect, it } from "vitest";
import {
  classForTargetOddsMin,
  COUPON_BOUNDS,
  COUPON_CLASSES,
} from "./coupon-classes";

describe("COUPON_CLASSES", () => {
  it("covers the leg-odds range without gap or overlap", () => {
    for (let i = 1; i < COUPON_CLASSES.length; i += 1) {
      expect(COUPON_CLASSES[i]?.minLegOdds).toBe(COUPON_CLASSES[i - 1]?.maxLegOdds);
    }
    expect(COUPON_CLASSES[0]?.minLegOdds).toBe(1.2);
  });

  it("lands each class on a distinct persisted odds range", () => {
    for (let i = 1; i < COUPON_CLASSES.length; i += 1) {
      expect(COUPON_CLASSES[i]?.targetOddsMin).toBeGreaterThan(
        COUPON_CLASSES[i - 1]?.targetOddsMax ?? -Infinity,
      );
    }
  });

  it("respects COUPON_BOUNDS.maxLegs for every class", () => {
    for (const c of COUPON_CLASSES) {
      expect(c.maxLegs).toBeLessThanOrEqual(COUPON_BOUNDS.maxLegs);
    }
  });
});

describe("classForTargetOddsMin", () => {
  it("resolves a known targetOddsMin to its class name", () => {
    expect(classForTargetOddsMin(1.0)).toBe("SAFE");
    expect(classForTargetOddsMin(3.0)).toBe("BALANCED");
    expect(classForTargetOddsMin(10.0)).toBe("BOLD");
  });

  it("returns null for an unrecognised targetOddsMin", () => {
    expect(classForTargetOddsMin(50.0)).toBeNull();
  });
});
