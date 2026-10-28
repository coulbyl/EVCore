import { describe, expect, it } from "vitest";
import {
  BTTS_HUNTER,
  DRAW_HUNTER,
  composeHunterByMarket,
  composeScoreHunter,
} from "./hunter-composer";
import type { DoubleCandidate } from "./double-composer";

/** BTTS coté complet (oui / non), au même prix chez le joueur. */
function btts(fixtureId: string, yes: number, no: number): DoubleCandidate[] {
  return [
    { fixtureId, market: "BTTS", pick: "YES", odds: yes, playableOdds: yes },
    { fixtureId, market: "BTTS", pick: "NO", odds: no, playableOdds: no },
  ];
}

describe("composeHunterByMarket", () => {
  it("takes the cheapest YES in the band, then the most likely", () => {
    const result = composeHunterByMarket(
      [
        // Marge 6,8 % : la moins chère, même si moins probable.
        ...btts("f1", 1.8, 1.95),
        // Marge 7,1 %, plus probable.
        ...btts("f2", 1.55, 2.35),
        // Hors bande (1,30) : jamais retenu.
        ...btts("f3", 1.3, 3.3),
      ],
      BTTS_HUNTER,
    );
    expect(result.outcome).toBe("picked");
    if (result.outcome !== "picked") return;
    expect(result.leg.fixtureId).toBe("f1");
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

describe("composeHunterByMarket — draw", () => {
  const oneXTwo = (
    fixtureId: string,
    [home, draw, away]: [number, number, number],
  ): DoubleCandidate[] =>
    (["HOME", "DRAW", "AWAY"] as const).map((pick, i) => {
      const odds = [home, draw, away][i] as number;
      return { fixtureId, market: "ONE_X_TWO", pick, odds, playableOdds: odds };
    });

  it("takes the cheapest draw rather than the most likely one", () => {
    const result = composeHunterByMarket(
      [
        // Nul à 3,00 mais marge 8,3 %.
        ...oneXTwo("f1", [2.4, 3.0, 3.0]),
        // Nul à 3,40, marge 2,6 % : retenu.
        ...oneXTwo("f2", [2.2, 3.4, 3.6]),
      ],
      DRAW_HUNTER,
    );
    expect(result.outcome).toBe("picked");
    if (result.outcome !== "picked") return;
    expect(result.leg.fixtureId).toBe("f2");
  });
});

describe("composeScoreHunter", () => {
  const score = (fixtureId: string, pick: string, odds: number) => ({
    fixtureId,
    competition: "PL",
    channel: "CORRECT_SCORE",
    market: "CORRECT_SCORE",
    pick,
    odds,
    probability: 0.12,
  });

  it("takes the score the market rates most likely in the 5–12 band", () => {
    const result = composeScoreHunter([
      score("f1", "1:1", 6.5),
      score("f2", "1:0", 5.8),
      // Hors bande : 4,5 et 13.
      score("f3", "1:0", 4.5),
      score("f4", "2:2", 13),
    ]);
    expect(result.outcome).toBe("picked");
    if (result.outcome !== "picked") return;
    expect(result.leg).toEqual(
      expect.objectContaining({ fixtureId: "f2", pick: "1:0" }),
    );
    // 1 / 5,8 / 1,27 : la marge typique de la grille retirée.
    expect(result.leg.probability).toBeCloseTo(0.1358, 3);
    expect(result.candidateCount).toBe(2);
  });

  it("abstains when no score is in the band", () => {
    expect(composeScoreHunter([score("f1", "0:0", 14)]).outcome).toBe(
      "abstained",
    );
  });
});
