import { describe, expect, it } from "vitest";
import {
  COMBO_CONFIG,
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
    odds: 1.25,
    probability: 0.8,
    fairProbability: 0.78,
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

  it("ships with the margin tie-break on, two points wide", () => {
    expect(COMBO_CONFIG.marginTieBreak).toEqual({ window: 0.02 });
  });

  describe("margin tie-break", () => {
    const cells = [
      green,
      { ...green, competition: "PL" },
      { ...green, competition: "SA" },
    ];
    const withTieBreak = {
      ...COMBO_CONFIG,
      legs: 2,
      marginTieBreak: { window: 0.02 },
    };

    it("takes, within a competition, the lowest margin among legs within the window of the cheapest", () => {
      const result = composeEngineCombo(
        [
          cand({ fixtureId: "a", odds: 1.22, probability: 0.82, margin: 0.09 }),
          cand({
            fixtureId: "b",
            odds: 1.25,
            probability: 0.805,
            margin: 0.03,
          }),
          cand({ fixtureId: "c", odds: 1.24, probability: 0.81, margin: 0.06 }),
          cand({ fixtureId: "d", odds: 1.3, competition: "PL", margin: 0.05 }),
        ],
        cells,
        withTieBreak,
      );
      expect(result.outcome).toBe("picked");
      if (result.outcome === "picked") {
        expect(result.legs.map((l) => l.fixtureId)).toEqual(["b", "d"]);
        expect(result.legs[0]?.margin).toBe(0.03);
      }
    });

    it("keeps the cheapest when the cheaper-margin leg is more than the window less likely", () => {
      const result = composeEngineCombo(
        [
          cand({ fixtureId: "a", odds: 1.22, probability: 0.82, margin: 0.09 }),
          cand({ fixtureId: "b", odds: 1.3, probability: 0.79, margin: 0.02 }),
          cand({ fixtureId: "d", odds: 1.3, competition: "PL" }),
        ],
        cells,
        withTieBreak,
      );
      expect(result.outcome).toBe("picked");
      if (result.outcome === "picked") {
        expect(result.legs.map((l) => l.fixtureId)).toEqual(["a", "d"]);
      }
    });

    it("keeps the cheapest when the market says the cheaper-margin leg is less likely, whatever the engine says", () => {
      const result = composeEngineCombo(
        [
          cand({ fixtureId: "a", odds: 1.22, probability: 0.82, margin: 0.09 }),
          // Engine tied (0.83), market 13 points lower: a claimed edge.
          cand({
            fixtureId: "b",
            odds: 1.45,
            probability: 0.83,
            fairProbability: 0.65,
            margin: 0.03,
          }),
          cand({ fixtureId: "d", odds: 1.3, competition: "PL" }),
        ],
        cells,
        withTieBreak,
      );
      expect(result.outcome).toBe("picked");
      if (result.outcome === "picked") {
        expect(result.legs.map((l) => l.fixtureId)).toEqual(["a", "d"]);
      }
    });

    it("keeps the cheapest when its own market frequency is unknown", () => {
      const result = composeEngineCombo(
        [
          cand({
            fixtureId: "a",
            odds: 1.22,
            margin: 0.09,
            fairProbability: null,
          }),
          cand({ fixtureId: "b", odds: 1.23, margin: 0.02 }),
          cand({ fixtureId: "d", odds: 1.3, competition: "PL" }),
        ],
        cells,
        withTieBreak,
      );
      expect(result.outcome === "picked" && result.legs[0]?.fixtureId).toBe(
        "a",
      );
    });

    it("never lets an unknown margin beat a known one, and falls back to the cheapest when none is known", () => {
      const result = composeEngineCombo(
        [
          cand({ fixtureId: "a", odds: 1.22, probability: 0.82, margin: null }),
          cand({ fixtureId: "b", odds: 1.23, probability: 0.82, margin: 0.08 }),
          cand({ fixtureId: "d", odds: 1.3, competition: "PL" }),
          cand({ fixtureId: "e", odds: 1.31, competition: "PL" }),
        ],
        cells,
        withTieBreak,
      );
      expect(result.outcome).toBe("picked");
      if (result.outcome === "picked") {
        expect(result.legs.map((l) => l.fixtureId)).toEqual(["b", "d"]);
      }
    });

    it("keeps the competitions the cheapest-first rule would take", () => {
      const legs = [
        cand({ fixtureId: "a", odds: 1.21, margin: 0.09 }),
        cand({ fixtureId: "b", odds: 1.22, competition: "PL", margin: 0.01 }),
        cand({ fixtureId: "c", odds: 1.4, competition: "SA", margin: 0.01 }),
      ];
      const plain = composeEngineCombo(legs, cells, {
        ...COMBO_CONFIG,
        legs: 2,
        marginTieBreak: undefined,
      });
      const tied = composeEngineCombo(legs, cells, withTieBreak);
      expect(
        plain.outcome === "picked" && plain.legs.map((l) => l.fixtureId),
      ).toEqual(["a", "b"]);
      expect(
        tied.outcome === "picked" && tied.legs.map((l) => l.fixtureId),
      ).toEqual(["a", "b"]);
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
});
