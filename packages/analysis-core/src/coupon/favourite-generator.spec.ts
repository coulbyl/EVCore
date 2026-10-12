import { describe, expect, it } from "vitest";
import { pickHomeFavourite } from "./favourite-generator";

const base = { market: "ONE_X_TWO", pick: "HOME" };

describe("pickHomeFavourite", () => {
  it("takes the shortest home favourite inside the band", () => {
    const result = pickHomeFavourite([
      { ...base, fixtureId: "b", odds: 1.25 },
      { ...base, fixtureId: "a", odds: 1.18 },
      { ...base, fixtureId: "c", odds: 1.3 },
    ]);
    expect(result.outcome).toBe("picked");
    if (result.outcome === "picked") {
      expect(result.leg.fixtureId).toBe("a");
      expect(result.candidateCount).toBe(3);
    }
  });

  it("ignores away picks, other markets and odds outside the band", () => {
    const result = pickHomeFavourite([
      { ...base, fixtureId: "x", odds: 1.05 },
      { ...base, fixtureId: "y", odds: 1.4 },
      { fixtureId: "z", market: "ONE_X_TWO", pick: "AWAY", odds: 1.2 },
      { fixtureId: "w", market: "DOUBLE_CHANCE", pick: "1X", odds: 1.15 },
      { ...base, fixtureId: "k", odds: 1.35 },
    ]);
    expect(result.outcome).toBe("picked");
    if (result.outcome === "picked") expect(result.leg.fixtureId).toBe("k");
  });

  it("abstains when no home favourite falls in the band", () => {
    const result = pickHomeFavourite([
      { ...base, fixtureId: "x", odds: 1.05 },
      { ...base, fixtureId: "y", odds: 1.6 },
    ]);
    expect(result).toEqual({
      outcome: "abstained",
      reason: "no_home_favourite_in_band",
      candidateCount: 0,
    });
  });

  it("breaks ties on fixture id so the choice is deterministic", () => {
    const a = pickHomeFavourite([
      { ...base, fixtureId: "b", odds: 1.2 },
      { ...base, fixtureId: "a", odds: 1.2 },
    ]);
    const b = pickHomeFavourite([
      { ...base, fixtureId: "a", odds: 1.2 },
      { ...base, fixtureId: "b", odds: 1.2 },
    ]);
    expect(a).toEqual(b);
    if (a.outcome === "picked") expect(a.leg.fixtureId).toBe("a");
  });
});
