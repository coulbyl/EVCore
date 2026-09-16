import { describe, expect, it } from "vitest";
import { settleAsianHandicap } from "./asian-handicap-settlement";

const bet = (
  pick: "HOME" | "AWAY",
  line: number,
  homeScore: number,
  awayScore: number,
  odds = 2,
) => settleAsianHandicap({ pick, line, odds, homeScore, awayScore });

describe("settleAsianHandicap", () => {
  describe("demi-ligne : gagné ou perdu, jamais remboursé", () => {
    it("domicile -0.5 gagne dès qu'il gagne le match", () => {
      expect(bet("HOME", -0.5, 1, 0)).toBe(2);
      expect(bet("HOME", -0.5, 0, 0)).toBe(0);
      expect(bet("HOME", -0.5, 0, 1)).toBe(0);
    });

    it("extérieur +0.5 gagne dès que le domicile ne gagne pas", () => {
      expect(bet("AWAY", -0.5, 0, 0)).toBe(2);
      expect(bet("AWAY", -0.5, 0, 1)).toBe(2);
      expect(bet("AWAY", -0.5, 1, 0)).toBe(0);
    });
  });

  describe("ligne entière : le nul corrigé rembourse", () => {
    it("rembourse quand le score corrigé est nul", () => {
      expect(bet("HOME", 0, 1, 1)).toBe(1);
      expect(bet("AWAY", 0, 1, 1)).toBe(1);
      // Domicile -1 et victoire 1-0 : corrigé 0-0, remboursé.
      expect(bet("HOME", -1, 1, 0)).toBe(1);
    });

    it("gagne ou perd normalement hors du nul corrigé", () => {
      expect(bet("HOME", -1, 2, 0)).toBe(2);
      expect(bet("HOME", -1, 0, 0)).toBe(0);
      expect(bet("AWAY", -1, 1, 0)).toBe(1);
      expect(bet("AWAY", -1, 0, 0)).toBe(2);
    });
  });

  describe("quart de ligne : la mise se scinde", () => {
    it("rend la moitié du gain quand une seule moitié passe", () => {
      // Domicile -0.25, victoire 1-0 : la moitié -0 est remboursée, la moitié
      // -0.5 gagne. Retour attendu (1 + 2) / 2.
      expect(bet("HOME", -0.25, 1, 1)).toBe(0.5);
      expect(bet("HOME", -0.25, 1, 0)).toBe(2);
    });

    it("perd la moitié quand une seule moitié échoue", () => {
      // Domicile -0.75, victoire 1-0 : moitié -0.5 gagne, moitié -1 remboursée.
      expect(bet("HOME", -0.75, 1, 0)).toBe(1.5);
      expect(bet("HOME", -0.75, 2, 0)).toBe(2);
      expect(bet("HOME", -0.75, 0, 0)).toBe(0);
    });

    it("traite symétriquement le côté extérieur", () => {
      expect(bet("AWAY", 0.25, 0, 1)).toBe(2);
      expect(bet("AWAY", 0.25, 1, 1)).toBe(0.5);
    });
  });

  // Les deux erreurs qui inventeraient ou effaceraient l'edge cherché.
  it("ne confond pas un quart de ligne avec une demi-ligne", () => {
    expect(bet("HOME", -0.25, 1, 1)).not.toBe(bet("HOME", -0.5, 1, 1));
    expect(bet("HOME", -0.25, 1, 1)).not.toBe(bet("HOME", 0, 1, 1));
  });

  it("ne traite pas une ligne entière comme une perte sèche", () => {
    expect(bet("HOME", 0, 2, 2)).toBe(1);
    expect(bet("HOME", -2, 2, 0)).toBe(1);
  });

  it("refuse une cote non jouable", () => {
    expect(bet("HOME", -0.5, 1, 0, 1)).toBe(0);
    expect(bet("HOME", -0.5, 1, 0, Number.NaN)).toBe(0);
  });

  // Somme des retours des deux côtés d'une même ligne : à cote équitable et
  // sans marge, un handicap rend exactement la mise engagée.
  it("conserve la mise quand les deux côtés sont pris à cote équitable", () => {
    for (const [home, away] of [
      [0, 0],
      [1, 0],
      [2, 1],
      [0, 3],
    ] as const) {
      for (const line of [-1, -0.75, -0.5, -0.25, 0, 0.5, 1]) {
        const total =
          settleAsianHandicap({
            pick: "HOME",
            line,
            odds: 2,
            homeScore: home,
            awayScore: away,
          }) +
          settleAsianHandicap({
            pick: "AWAY",
            line,
            odds: 2,
            homeScore: home,
            awayScore: away,
          });
        expect(total).toBeCloseTo(2, 10);
      }
    }
  });
});
