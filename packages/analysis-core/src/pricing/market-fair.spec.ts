import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { Market } from "../types";
import {
  computeMarketFair,
  oppositePick,
  overUnderOpposite,
  siblingOutcomeOdds,
} from "./market-fair";
import type { FullOddsSnapshot } from "../selection/types";

const odds: FullOddsSnapshot = {
  bookmaker: "test",
  snapshotAt: new Date("2026-06-12T12:00:00.000Z"),
  homeOdds: new Decimal("1.80"),
  drawOdds: new Decimal("3.40"),
  awayOdds: new Decimal("4.20"),
  overUnderOdds: { OVER: new Decimal("1.95"), UNDER: new Decimal("1.85") },
  bttsYesOdds: new Decimal("1.70"),
  bttsNoOdds: new Decimal("2.10"),
  htftOdds: {},
  ouHtOdds: {},
  firstHalfWinnerOdds: null,
  doubleChanceOdds: null,
  drawNoBetOdds: { home: new Decimal("1.22"), away: new Decimal("4.00") },
  teamTotalHomeOdds: { OVER_1_5: new Decimal("1.57") },
  teamTotalAwayOdds: {},
  cleanSheetHomeOdds: { yes: new Decimal("2.38"), no: new Decimal("1.53") },
  cleanSheetAwayOdds: null,
  winToNilHomeOdds: null,
  winToNilAwayOdds: null,
  winEitherHalfOdds: { home: new Decimal("1.30"), away: new Decimal("3.00") },
  resultTotalGoalsOdds: { HOME_OVER_2_5: new Decimal("2.20") },
  resultBttsOdds: { HOME_YES: new Decimal("2.95") },
};

describe("overUnderOpposite", () => {
  it("pairs the bare OVER/UNDER 2.5 line", () => {
    expect(overUnderOpposite("OVER")).toBe("UNDER");
    expect(overUnderOpposite("UNDER")).toBe("OVER");
  });

  it("pairs every other line by its suffix", () => {
    expect(overUnderOpposite("OVER_1_5")).toBe("UNDER_1_5");
    expect(overUnderOpposite("UNDER_3_5")).toBe("OVER_3_5");
  });

  it("returns null for an unrelated pick", () => {
    expect(overUnderOpposite("HOME")).toBeNull();
  });
});

describe("oppositePick", () => {
  it("flips YES/NO markets", () => {
    expect(oppositePick("YES")).toBe("NO");
    expect(oppositePick("NO")).toBe("YES");
  });

  it("falls back to overUnderOpposite for OVER/UNDER-shaped picks", () => {
    expect(oppositePick("OVER_1_5")).toBe("UNDER_1_5");
  });

  it("returns null for a three-way pick (no clean fade)", () => {
    expect(oppositePick("HOME")).toBeNull();
    expect(oppositePick("DRAW")).toBeNull();
  });
});

describe("siblingOutcomeOdds", () => {
  it("returns the other two outcomes for a 1X2 pick", () => {
    const siblings = siblingOutcomeOdds(Market.ONE_X_TWO, "HOME", odds);
    expect(siblings?.map((d) => d.toNumber())).toEqual([3.4, 4.2]);
  });

  it("returns the opposite outcome for a BTTS pick", () => {
    const siblings = siblingOutcomeOdds(Market.BTTS, "YES", odds);
    expect(siblings?.map((d) => d.toNumber())).toEqual([2.1]);
  });

  it("returns the opposite line for an OVER_UNDER pick", () => {
    const siblings = siblingOutcomeOdds(Market.OVER_UNDER, "OVER", odds);
    expect(siblings?.map((d) => d.toNumber())).toEqual([1.85]);
  });

  it("returns null for a market with no clean exhaustive partition", () => {
    expect(siblingOutcomeOdds(Market.DOUBLE_CHANCE, "1X", odds)).toBeNull();
  });

  it("returns null when a sibling outcome's odds are missing", () => {
    const partial: FullOddsSnapshot = { ...odds, drawOdds: null as never };
    expect(siblingOutcomeOdds(Market.ONE_X_TWO, "HOME", partial)).toBeNull();
  });
});

describe("computeMarketFair", () => {
  it("removes the overround from a 1X2 pick", () => {
    const fair = computeMarketFair(Market.ONE_X_TWO, "HOME", odds);
    expect(fair).not.toBeNull();
    expect(fair?.pMarketFair).toBeGreaterThan(0);
    expect(fair?.pMarketFair).toBeLessThan(1);
    expect(fair?.bookmakerMargin).toBeGreaterThan(0);
  });

  it("returns null when the pick's own odds are unavailable", () => {
    expect(computeMarketFair(Market.CORRECT_SCORE, "2:1", odds)).toBeNull();
  });

  it("returns null when siblings are unavailable (no clean partition)", () => {
    expect(computeMarketFair(Market.DOUBLE_CHANCE, "1X", odds)).toBeNull();
  });
});
