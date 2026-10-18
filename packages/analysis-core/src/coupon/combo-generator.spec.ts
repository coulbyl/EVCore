import { describe, expect, it } from "vitest";
import {
  composeEngineCombo,
  composeEngineLong,
  eligibleComboLegs,
  type CalibrationCell,
  type ComboCandidate,
} from "./combo-generator";

function cand(
  over: Partial<ComboCandidate> & { fixtureId: string },
): ComboCandidate {
  return {
    competition: "L1",
    channel: "GOALS",
    market: "OVER_UNDER",
    pick: "OVER_1_5",
    odds: 1.25,
    probability: 0.8,
    ...over,
  };
}
const green: CalibrationCell = {
  channel: "GOALS",
  competition: "L1",
  sampleSize: 100,
  ratio: 0.95,
};

describe("composeEngineCombo", () => {
  it("takes the two cheapest calibrated legs at or above 1.20, one per competition", () => {
    const result = composeEngineCombo(
      [
        cand({ fixtureId: "a", odds: 1.3 }),
        cand({ fixtureId: "b", odds: 1.21, competition: "PL" }),
        cand({ fixtureId: "c", odds: 1.15 }),
        cand({ fixtureId: "d", odds: 1.25, competition: "SA" }),
        cand({ fixtureId: "e", odds: 1.22, competition: "PL" }),
      ],
      [green, { ...green, competition: "PL" }, { ...green, competition: "SA" }],
    );
    expect(result.outcome).toBe("picked");
    if (result.outcome === "picked") {
      // "c" at 1.15 is under the floor; "e" shares PL with "b".
      expect(result.legs.map((l) => l.fixtureId)).toEqual(["b", "d"]);
    }
  });

  it("keeps the screen's primary pick per fixture (tier, probability, odds)", () => {
    const result = composeEngineCombo(
      [
        cand({ fixtureId: "a", odds: 1.21, probability: 0.9, channel: "BTTS" }),
        cand({ fixtureId: "a", odds: 1.3, probability: 0.8 }),
        cand({ fixtureId: "b", odds: 1.4, competition: "PL" }),
        cand({ fixtureId: "c", odds: 1.45, competition: "SA" }),
      ],
      [
        green,
        { ...green, competition: "PL" },
        { ...green, competition: "SA" },
        { channel: "BTTS", competition: "L1", sampleSize: 100, ratio: 0.5 },
      ],
    );
    expect(result.outcome).toBe("picked");
    if (result.outcome === "picked") {
      const a = result.legs.find((l) => l.fixtureId === "a");
      // BTTS is RED on L1: the fixture's primary pick is the GOALS leg.
      expect(a?.channel).toBe("GOALS");
    }
  });

  it("treats an unmeasured cell as eligible but never a red one", () => {
    const result = composeEngineCombo(
      [
        cand({ fixtureId: "a", channel: "TEAM_TOTAL" }),
        cand({ fixtureId: "c", competition: "SA" }),
      ],
      [{ channel: "GOALS", competition: "SA", sampleSize: 100, ratio: 0.6 }],
    );
    // "a" (unmeasured) is eligible, "c" (red) is not: one leg, not two.
    expect(result).toMatchObject({
      outcome: "abstained",
      reason: "not_enough_calibrated_short_legs",
      candidateCount: 1,
    });
  });

  it("abstains when fewer than three short legs exist", () => {
    const result = composeEngineCombo(
      [
        cand({ fixtureId: "a", odds: 1.8 }),
        cand({ fixtureId: "b", odds: 1.2 }),
      ],
      [green],
    );
    expect(result.outcome).toBe("abstained");
  });

  it("lists the eligible legs cheapest-first, one per fixture, without a competition cap", () => {
    const legs = eligibleComboLegs(
      [
        cand({ fixtureId: "a", odds: 1.3 }),
        cand({ fixtureId: "a", odds: 1.21, probability: 0.9 }),
        cand({ fixtureId: "b", odds: 1.25 }),
        cand({ fixtureId: "c", odds: 1.7 }),
        cand({ fixtureId: "d", odds: 1.1 }),
      ],
      [green],
    );
    // "d" is under the 1.20 floor; "c" is above the 1.50 cap.
    expect(legs.map((l) => `${l.fixtureId}@${l.odds}`)).toEqual([
      "a@1.21",
      "b@1.25",
    ]);
  });

  it("builds the long coupon longest-first, one per competition, until the 2.5 target", () => {
    const result = composeEngineLong(
      [
        cand({ fixtureId: "a", odds: 1.7 }),
        cand({ fixtureId: "b", odds: 1.6, competition: "PL" }),
        cand({ fixtureId: "c", odds: 1.75, competition: "PL" }),
        cand({ fixtureId: "d", odds: 1.3, competition: "SA" }),
        cand({ fixtureId: "e", odds: 1.9, competition: "BL1" }),
      ],
      [green, { ...green, competition: "PL" }, { ...green, competition: "SA" }],
    );
    expect(result.outcome).toBe("picked");
    if (result.outcome === "picked") {
      // "e" is above 1.80; "c" wins PL over "b"; 1.75 × 1.7 = 2.98 ≥ 2.5.
      expect(result.legs.map((l) => l.fixtureId)).toEqual(["c", "a"]);
    }
  });

  it("abstains when the target cannot be reached within four legs", () => {
    const result = composeEngineLong(
      [
        cand({ fixtureId: "a", odds: 1.25 }),
        cand({ fixtureId: "b", odds: 1.22, competition: "PL" }),
      ],
      [green, { ...green, competition: "PL" }],
    );
    expect(result).toMatchObject({
      outcome: "abstained",
      reason: "target_unreachable",
    });
  });
});
