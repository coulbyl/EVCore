import { describe, expect, it } from "vitest";
import {
  composeEngineCombo,
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
    odds: 1.2,
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
  it("takes the three cheapest calibrated short legs, one per competition", () => {
    const result = composeEngineCombo(
      [
        cand({ fixtureId: "a", odds: 1.3 }),
        cand({ fixtureId: "b", odds: 1.1, competition: "PL" }),
        cand({ fixtureId: "c", odds: 1.15 }),
        cand({ fixtureId: "d", odds: 1.25, competition: "SA" }),
        cand({ fixtureId: "e", odds: 1.12, competition: "PL" }),
      ],
      [green, { ...green, competition: "PL" }, { ...green, competition: "SA" }],
    );
    expect(result.outcome).toBe("picked");
    if (result.outcome === "picked") {
      expect(result.legs.map((l) => l.fixtureId)).toEqual(["b", "c", "d"]);
    }
  });

  it("keeps the screen's primary pick per fixture (tier, probability, odds)", () => {
    const result = composeEngineCombo(
      [
        cand({ fixtureId: "a", odds: 1.1, probability: 0.9, channel: "BTTS" }),
        cand({ fixtureId: "a", odds: 1.3, probability: 0.8 }),
        cand({ fixtureId: "b", odds: 1.2, competition: "PL" }),
        cand({ fixtureId: "c", odds: 1.2, competition: "SA" }),
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
        cand({ fixtureId: "b", competition: "PL" }),
        cand({ fixtureId: "c", competition: "SA" }),
      ],
      [
        { ...green, competition: "PL" },
        { channel: "GOALS", competition: "SA", sampleSize: 100, ratio: 0.6 },
      ],
    );
    expect(result).toMatchObject({
      outcome: "abstained",
      reason: "not_enough_calibrated_short_legs",
      candidateCount: 2,
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
        cand({ fixtureId: "a", odds: 1.1, probability: 0.9 }),
        cand({ fixtureId: "b", odds: 1.15 }),
        cand({ fixtureId: "c", odds: 1.7 }),
      ],
      [green],
    );
    expect(legs.map((l) => `${l.fixtureId}@${l.odds}`)).toEqual([
      "a@1.1",
      "b@1.15",
    ]);
  });
});
