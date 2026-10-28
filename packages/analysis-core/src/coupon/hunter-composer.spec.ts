import { describe, expect, it } from "vitest";
import {
  BTTS_HUNTER,
  DRAW_HUNTER,
  composeHunterByEngine,
  composeHunterByMarket,
} from "./hunter-composer";
import type { DoubleCandidate } from "./double-composer";
import type { CalibrationCell, ComboCandidate } from "./combo-generator";

/** BTTS coté complet (oui / non), au même prix chez le joueur. */
function btts(fixtureId: string, yes: number, no: number): DoubleCandidate[] {
  return [
    { fixtureId, market: "BTTS", pick: "YES", odds: yes, playableOdds: yes },
    { fixtureId, market: "BTTS", pick: "NO", odds: no, playableOdds: no },
  ];
}

describe("composeHunterByMarket", () => {
  it("takes the most likely YES in the band, margin removed", () => {
    const result = composeHunterByMarket(
      [
        ...btts("f1", 1.8, 1.95),
        ...btts("f2", 1.55, 2.35),
        // Hors bande (1,30) : jamais retenu, même plus probable.
        ...btts("f3", 1.3, 3.3),
      ],
      BTTS_HUNTER,
    );
    expect(result.outcome).toBe("picked");
    if (result.outcome !== "picked") return;
    expect(result.leg.fixtureId).toBe("f2");
    expect(result.candidateCount).toBe(2);
  });

  it("abstains when nothing is priced in the band", () => {
    expect(composeHunterByMarket(btts("f1", 1.3, 3.3), BTTS_HUNTER)).toEqual({
      outcome: "abstained",
      reason: "no_candidate_in_band",
      candidateCount: 0,
    });
  });
});

describe("composeHunterByEngine", () => {
  const draw = (
    fixtureId: string,
    competition: string,
    probability: number,
    odds = 3.2,
  ): ComboCandidate => ({
    fixtureId,
    competition,
    channel: "DRAW",
    market: "ONE_X_TWO",
    pick: "DRAW",
    odds,
    probability,
  });
  const cell = (
    competition: string,
    ratio: number,
    sampleSize = 50,
  ): CalibrationCell => ({ channel: "DRAW", competition, sampleSize, ratio });

  it("ranks by the channel probability recalibrated per competition", () => {
    const result = composeHunterByEngine(
      [draw("f1", "PL", 0.32), draw("f2", "SA", 0.3)],
      // PL annonce trop (0,8) : 0,256 ; SA tient (1,0) : 0,30.
      [cell("PL", 0.8), cell("SA", 1.0)],
      DRAW_HUNTER,
    );
    expect(result.outcome).toBe("picked");
    if (result.outcome !== "picked") return;
    expect(result.leg.fixtureId).toBe("f2");
    // La jambe annonce la probabilité du canal, pas la recalée.
    expect(result.leg.probability).toBe(0.3);
  });

  it("drops unreliable cells and keeps unmeasured ones at face value", () => {
    const result = composeHunterByEngine(
      [draw("f1", "PL", 0.34), draw("f2", "L1", 0.29)],
      [cell("PL", 0.6), cell("L1", 1.2, 10)],
      DRAW_HUNTER,
    );
    expect(result.outcome).toBe("picked");
    if (result.outcome !== "picked") return;
    expect(result.leg.fixtureId).toBe("f2");
  });

  it("ignores other channels and odds outside the band", () => {
    const result = composeHunterByEngine(
      [
        { ...draw("f1", "PL", 0.3), channel: "DOMINANT" },
        draw("f2", "PL", 0.3, 4.1),
      ],
      [],
      DRAW_HUNTER,
    );
    expect(result.outcome).toBe("abstained");
  });
});
