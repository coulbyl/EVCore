import { describe, expect, it } from "vitest";
import { Market } from "@evcore/analysis-core";
import { isValidPickForMarket } from "./known-picks";

describe("isValidPickForMarket", () => {
  it("accepts a legal fixed pick", () => {
    expect(isValidPickForMarket(Market.BTTS, "YES")).toBe(true);
    expect(isValidPickForMarket(Market.ONE_X_TWO, "DRAW")).toBe(true);
  });

  it("rejects a hallucinated pick on a fixed-list market", () => {
    expect(isValidPickForMarket(Market.BTTS, "Home wins comfortably")).toBe(
      false,
    );
    expect(isValidPickForMarket(Market.ONE_X_TWO, "MAYBE")).toBe(false);
  });

  it("accepts a legal combinatorial pick by pattern", () => {
    expect(isValidPickForMarket(Market.RESULT_BTTS, "HOME_YES")).toBe(true);
    expect(
      isValidPickForMarket(Market.RESULT_TOTAL_GOALS, "AWAY_OVER_2_5"),
    ).toBe(true);
    expect(isValidPickForMarket(Market.CORRECT_SCORE, "2:1")).toBe(true);
  });

  it("rejects a malformed combinatorial pick", () => {
    expect(isValidPickForMarket(Market.RESULT_BTTS, "HOME_MAYBE")).toBe(false);
    expect(isValidPickForMarket(Market.CORRECT_SCORE, "two-one")).toBe(false);
  });

  it("rejects any pick on an unknown market", () => {
    expect(isValidPickForMarket("NOT_A_REAL_MARKET", "YES")).toBe(false);
  });
});
