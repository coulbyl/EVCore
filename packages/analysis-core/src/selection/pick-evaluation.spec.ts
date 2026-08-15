import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { Market } from "../types";
import type { EvaluatedPick } from "./types";
import { bestQualityPickDetails } from "./pick-evaluation";

function pick(overrides: Partial<EvaluatedPick> = {}): EvaluatedPick {
  return {
    market: Market.ONE_X_TWO,
    pick: "HOME",
    probability: new Decimal(0.6),
    odds: new Decimal(1.8),
    ev: new Decimal(0.08),
    qualityScore: new Decimal(0.05),
    ...overrides,
  };
}

describe("bestQualityPickDetails", () => {
  it("returns undefined for an empty pool", () => {
    expect(bestQualityPickDetails([])).toBeUndefined();
  });

  it("surfaces the highest-qualityScore candidate, viable or not", () => {
    const rejected = pick({
      pick: "AWAY",
      qualityScore: new Decimal(0.09),
      rejectionReason: "ev_below_threshold",
    });
    const viable = pick({ pick: "HOME", qualityScore: new Decimal(0.05) });

    const details = bestQualityPickDetails([viable, rejected]);

    expect(details).toMatchObject({
      market: Market.ONE_X_TWO,
      pick: "AWAY",
      rejectionReason: "ev_below_threshold",
    });
  });

  it("computes edge as probability minus the implied odds probability", () => {
    const candidate = pick({
      probability: new Decimal(0.6),
      odds: new Decimal(2),
    });
    const details = bestQualityPickDetails([candidate]);
    // implied = 1/2 = 0.5, edge = 0.6 - 0.5 = 0.1
    expect(details?.["edge"]).toBeCloseTo(0.1, 10);
  });

  it("reports rejectionReason as null for a viable top candidate", () => {
    const details = bestQualityPickDetails([pick()]);
    expect(details?.["rejectionReason"]).toBeNull();
  });
});
