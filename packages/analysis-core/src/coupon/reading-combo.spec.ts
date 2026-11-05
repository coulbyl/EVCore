import { describe, expect, it } from "vitest";
import { COMBO_COUPON_CLASS } from "./coupon-classes";
import {
  composeReadingCombo,
  READING_COMBO_CONFIG,
  type ReadingLeg,
} from "./reading-combo";

const leg = (over: Partial<ReadingLeg> = {}): ReadingLeg => ({
  fixtureId: "f",
  competition: "L1",
  market: "ONE_X_TWO",
  pick: "HOME",
  odds: 1.4,
  chance: 0.68,
  ...over,
});

describe("COMBO_COUPON_CLASS", () => {
  it("takes two legs priced 1.30 to 1.80 at 1xBet, combined 1.80 to 2.60, same stored identity", () => {
    expect(COMBO_COUPON_CLASS).toMatchObject({
      minLegOdds: 1.3,
      maxLegOdds: 1.8,
      maxLegs: 2,
      targetOddsMin: 1.2,
      targetOddsMax: 3.4,
    });
    expect(READING_COMBO_CONFIG).toMatchObject({
      legs: 2,
      minCombinedOdds: 1.8,
      maxCombinedOdds: 2.6,
    });
  });
});

describe("composeReadingCombo", () => {
  it("ranks on the market's frequency, one reading per league, first pair in the combined band", () => {
    const result = composeReadingCombo([
      leg({ fixtureId: "a", competition: "L1", odds: 1.35, chance: 0.72 }),
      // Same league, lower frequency: never the second leg.
      leg({ fixtureId: "b", competition: "L1", odds: 1.5, chance: 0.64 }),
      leg({ fixtureId: "c", competition: "PL", odds: 1.32, chance: 0.71 }),
      leg({ fixtureId: "d", competition: "SA", odds: 1.45, chance: 0.66 }),
    ]);
    // a × c = 1.782 < 1.80: the first pair in the band is a × d (1.9575).
    expect(result).toMatchObject({ outcome: "picked", candidateCount: 3 });
    if (result.outcome !== "picked") return;
    expect(result.legs.map((l) => l.fixtureId)).toEqual(["a", "d"]);
  });

  it("keeps only readings priced 1.30 to 1.80 at 1xBet", () => {
    const result = composeReadingCombo([
      leg({ fixtureId: "a", competition: "L1", odds: 1.25, chance: 0.78 }),
      leg({ fixtureId: "b", competition: "PL", odds: 1.85, chance: 0.52 }),
      leg({ fixtureId: "c", competition: "SA", odds: 1.5, chance: 0.64 }),
    ]);
    expect(result).toEqual({
      outcome: "abstained",
      reason: "not_enough_readings",
      candidateCount: 1,
    });
  });

  it("abstains when no pair lands in 1.80 to 2.60", () => {
    const result = composeReadingCombo([
      leg({ fixtureId: "a", competition: "L1", odds: 1.3 }),
      leg({ fixtureId: "b", competition: "PL", odds: 1.3 }),
    ]);
    expect(result).toMatchObject({
      outcome: "abstained",
      reason: "no_combination_in_band",
    });
  });

  it("a match without a reading is simply absent: the next reading takes its place", () => {
    const result = composeReadingCombo([
      leg({ fixtureId: "a", competition: "L1", odds: 1.4 }),
      leg({ fixtureId: "c", competition: "SA", odds: 1.6, chance: 0.6 }),
    ]);
    expect(result.outcome).toBe("picked");
    if (result.outcome !== "picked") return;
    expect(result.legs.map((l) => l.fixtureId)).toEqual(["a", "c"]);
  });
});
