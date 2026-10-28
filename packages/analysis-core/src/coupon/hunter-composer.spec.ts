import { describe, expect, it } from "vitest";
import {
  CORNERS_HUNTER,
  composeCornersHunter,
  priceCornersSides,
  type CornersQuote,
  BTTS_HUNTER,
  DRAW_HUNTER,
  composeHunterByMarket,
  composeScoreHunter,
} from "./hunter-composer";
import type { DoubleCandidate } from "./double-composer";

/** BTTS coté complet (oui / non), au même prix chez le joueur : la marge
 * payée chez 1xBet est celle du groupe. */
function btts(fixtureId: string, yes: number, no: number): DoubleCandidate[] {
  const operatorMargin = 1 / yes + 1 / no - 1;
  return [
    {
      fixtureId,
      market: "BTTS",
      pick: "YES",
      odds: yes,
      playableOdds: yes,
      operatorMargin,
    },
    {
      fixtureId,
      market: "BTTS",
      pick: "NO",
      odds: no,
      playableOdds: no,
      operatorMargin,
    },
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

  it("ranks on the margin paid at 1xBet, not the reference one", () => {
    // Même référence ; 1xBet prend 9 % sur f1, 4 % sur f2.
    const result = composeHunterByMarket(
      [
        ...btts("f1", 1.8, 1.95).map((c) => ({ ...c, operatorMargin: 0.09 })),
        ...btts("f2", 1.8, 1.95).map((c) => ({ ...c, operatorMargin: 0.04 })),
      ],
      BTTS_HUNTER,
    );
    expect(result.outcome).toBe("picked");
    if (result.outcome !== "picked") return;
    expect(result.leg.fixtureId).toBe("f2");
    expect(result.leg.operatorMargin).toBe(0.04);
  });

  it("assumes 1xBet's typical margin when its group is incomplete", () => {
    // f1 sans prix 1xBet complet : 8 % supposés pour BTTS ; f2 à 8,5 %.
    const result = composeHunterByMarket(
      [
        ...btts("f1", 1.7, 2.1).map((c) => ({ ...c, operatorMargin: null })),
        ...btts("f2", 1.8, 1.95).map((c) => ({ ...c, operatorMargin: 0.085 })),
      ],
      BTTS_HUNTER,
    );
    expect(result.outcome).toBe("picked");
    if (result.outcome !== "picked") return;
    expect(result.leg.fixtureId).toBe("f1");
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
      const operatorMargin = 1 / home + 1 / draw + 1 / away - 1;
      return {
        fixtureId,
        market: "ONE_X_TWO",
        pick,
        odds,
        playableOdds: odds,
        operatorMargin,
      };
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

describe("Chasseur Corners", () => {
  const at = new Date("2026-10-30T10:00:00Z");
  const quote = (
    q: Partial<CornersQuote> & Pick<CornersQuote, "pick" | "odds">,
  ): CornersQuote => ({
    fixtureId: "f1",
    line: 9.5,
    bookmaker: "1xBet",
    snapshotAt: at,
    ...q,
  });

  it("prices both sides on the same 1xBet snapshot, market frequency from Pinnacle", () => {
    const sides = priceCornersSides(
      [
        quote({ pick: "OVER", odds: 1.9 }),
        quote({ pick: "UNDER", odds: 1.8 }),
        quote({ pick: "OVER", odds: 2.0, bookmaker: "Pinnacle" }),
        quote({ pick: "UNDER", odds: 1.85, bookmaker: "Pinnacle" }),
        // Ligne entière : remboursement possible, écartée.
        quote({ pick: "OVER", odds: 1.7, line: 10 }),
        quote({ pick: "UNDER", odds: 2.0, line: 10 }),
        // Paire sur deux relevés différents : écartée.
        quote({ pick: "OVER", odds: 2.2, line: 10.5 }),
        quote({
          pick: "UNDER",
          odds: 1.6,
          line: 10.5,
          snapshotAt: new Date("2026-10-30T08:00:00Z"),
        }),
      ],
      "1xBet",
      "Pinnacle",
    );
    expect(sides).toHaveLength(2);
    const over = sides.find((s) => s.pick === "OVER");
    // 1/1,9 + 1/1,8 − 1 = 8,19 %.
    expect(over?.margin.toNumber()).toBeCloseTo(0.0819, 4);
    // Pinnacle : 0,5 / (0,5 + 0,5405) = 0,4805.
    expect(over?.fair.toNumber()).toBeCloseTo(0.4805, 3);
  });

  it("picks the cheapest side in the band, then the more likely", () => {
    const sides = priceCornersSides(
      [
        quote({ pick: "OVER", odds: 1.9 }),
        quote({ pick: "UNDER", odds: 1.8 }),
        quote({ fixtureId: "f2", pick: "OVER", odds: 1.95 }),
        quote({ fixtureId: "f2", pick: "UNDER", odds: 1.88 }),
        // Hors bande : 1,40.
        quote({ fixtureId: "f3", pick: "OVER", odds: 1.4 }),
        quote({ fixtureId: "f3", pick: "UNDER", odds: 2.9 }),
      ],
      "1xBet",
      "Pinnacle",
    );
    const composition = composeCornersHunter(sides);
    expect(composition.outcome).toBe("picked");
    if (composition.outcome !== "picked") return;
    // f2 coûte 4,5 %, f1 8,2 % ; sur f2, MOINS est plus probable que PLUS.
    expect(composition.leg).toMatchObject({
      fixtureId: "f2",
      market: CORNERS_HUNTER.market,
      pick: "UNDER",
      line: 9.5,
      odds: 1.88,
      operatorOdds: 1.88,
    });
    expect(composition.leg.operatorMargin).toBeCloseTo(0.0448, 3);
    expect(composition.candidateCount).toBe(4);
  });

  it("abstains with no side in the band", () => {
    expect(composeCornersHunter([])).toMatchObject({
      outcome: "abstained",
      reason: "no_candidate_in_band",
    });
  });
});
