import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { shinDoubleChance, shinOutcomeGroups, shinProbabilities } from "./shin";

const group = (odds: Record<string, number>) =>
  Object.entries(odds).map(([pick, o]) => ({ pick, odds: new Decimal(o) }));

const rounded = (fair: Map<string, Decimal> | null) =>
  fair &&
  Object.fromEntries(
    [...fair].map(([k, v]) => [k, v.toDecimalPlaces(6).toNumber()]),
  );

describe("shinProbabilities", () => {
  // Reference values from an independent implementation (fixed-point
  // iteration on z, Jullien & Salanié), not from this bisection.
  it("matches the reference on a three-way market", () => {
    expect(
      rounded(shinProbabilities(group({ HOME: 1.5, DRAW: 4.2, AWAY: 6.5 }))),
    ).toEqual({ HOME: 0.642656, DRAW: 0.220101, AWAY: 0.137243 });
    expect(
      rounded(shinProbabilities(group({ HOME: 1.25, DRAW: 6, AWAY: 13 }))),
    ).toEqual({ HOME: 0.780641, DRAW: 0.153875, AWAY: 0.065484 });
  });

  it("matches the reference on a two-way market", () => {
    expect(rounded(shinProbabilities(group({ OVER: 1.8, UNDER: 2 })))).toEqual({
      OVER: 0.527778,
      UNDER: 0.472222,
    });
  });

  it("takes from the outsider, not from the favourite, unlike the proportional removal", () => {
    const odds = { HOME: 1.25, DRAW: 6, AWAY: 13 };
    const fair = shinProbabilities(group(odds));
    const booksum = 1 / 1.25 + 1 / 6 + 1 / 13;
    // Proportional: 0,0737 for the outsider; Shin: 0,0655.
    expect(fair?.get("AWAY")?.toNumber()).toBeLessThan(1 / 13 / booksum);
    expect(fair?.get("HOME")?.toNumber()).toBeGreaterThan(1 / 1.25 / booksum);
  });

  it("sums to one", () => {
    const fair = shinProbabilities(group({ HOME: 2.1, DRAW: 3.3, AWAY: 3.6 }));
    const total = [...(fair?.values() ?? [])].reduce(
      (acc, p) => acc.plus(p),
      new Decimal(0),
    );
    expect(total.toDecimalPlaces(12).toNumber()).toBe(1);
  });

  it("prices nothing it cannot price", () => {
    expect(shinProbabilities(group({ HOME: 1.9 }))).toBeNull();
    expect(shinProbabilities(group({ OVER: 1, UNDER: 5 }))).toBeNull();
    // No margin at all: z has no meaning.
    expect(shinProbabilities(group({ OVER: 2, UNDER: 2 }))).toBeNull();
  });
});

describe("shinDoubleChance", () => {
  it("adds the 1X2 fair probabilities pair by pair", () => {
    expect(
      rounded(shinDoubleChance(group({ HOME: 1.5, DRAW: 4.2, AWAY: 6.5 }))),
    ).toEqual({ "1X": 0.862757, X2: 0.357344, "12": 0.779899 });
  });

  it("needs the three outcomes of 1X2", () => {
    expect(shinDoubleChance(group({ HOME: 1.5, AWAY: 6.5 }))).toBeNull();
  });
});

describe("shinOutcomeGroups", () => {
  const row = (
    market: string,
    pick: string,
    odds: number,
    fixtureId = "f1",
  ) => ({
    fixtureId,
    market,
    pick,
    odds,
  });

  it("prices each complete group of a fixture, apart", () => {
    const priced = shinOutcomeGroups([
      row("ONE_X_TWO", "HOME", 1.5),
      row("ONE_X_TWO", "DRAW", 4.2),
      row("ONE_X_TWO", "AWAY", 6.5),
      row("OVER_UNDER", "OVER", 1.8),
      row("OVER_UNDER", "UNDER", 2),
      // OVER_1_5 has no UNDER_1_5: its group is incomplete, left out.
      row("OVER_UNDER", "OVER_1_5", 1.3),
    ]);
    const fair = Object.fromEntries(
      priced.map((p) => [
        `${p.market}/${p.pick}`,
        p.fair.toDecimalPlaces(6).toNumber(),
      ]),
    );
    expect(fair).toEqual({
      "ONE_X_TWO/HOME": 0.642656,
      "ONE_X_TWO/DRAW": 0.220101,
      "ONE_X_TWO/AWAY": 0.137243,
      "OVER_UNDER/OVER": 0.527778,
      "OVER_UNDER/UNDER": 0.472222,
    });
  });

  it("reads double chance from the 1X2 of the same fixture", () => {
    const priced = shinOutcomeGroups([
      row("ONE_X_TWO", "HOME", 1.5),
      row("ONE_X_TWO", "DRAW", 4.2),
      row("ONE_X_TWO", "AWAY", 6.5),
      row("DOUBLE_CHANCE", "1X", 1.12),
      // Another fixture's 1X2 never prices this one.
      row("DOUBLE_CHANCE", "X2", 2.4, "f2"),
    ]);
    const dc = priced.filter((p) => p.market === "DOUBLE_CHANCE");
    expect(
      dc.map((p) => [
        p.fixtureId,
        p.pick,
        p.fair.toDecimalPlaces(6).toNumber(),
      ]),
    ).toEqual([["f1", "1X", 0.862757]]);
  });
});
