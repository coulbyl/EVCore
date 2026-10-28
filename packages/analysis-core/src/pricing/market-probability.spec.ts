import { describe, expect, it } from "vitest";
import { marketProbability } from "./market-probability";

describe("marketProbability", () => {
  it("removes the margin paid when it is recorded", () => {
    // 1 / 1,40 = 0,7143 ; marge 5 % : 0,7143 / 1,05 = 0,6803.
    expect(
      marketProbability({ odds: 1.4, market: "ONE_X_TWO", marginPaid: 0.05 }),
    ).toBe(0.6803);
  });

  it("falls back to the market's typical margin", () => {
    // BTTS : marge typique 7,5 %.
    expect(marketProbability({ odds: 1.8, market: "BTTS" })).toBe(0.5168);
  });

  it("uses a default margin for markets without a clean outcome group", () => {
    expect(marketProbability({ odds: 1.5, market: "TO_WIN_EITHER_HALF" })).toBe(
      0.6289,
    );
  });

  it("has nothing to say without a price", () => {
    expect(marketProbability({ odds: null, market: "BTTS" })).toBeNull();
    expect(marketProbability({ odds: 1, market: "BTTS" })).toBeNull();
  });
});
