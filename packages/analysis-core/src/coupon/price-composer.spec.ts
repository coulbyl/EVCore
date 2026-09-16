import { describe, expect, it } from "vitest";
import {
  composeByPrice,
  type PriceCandidate,
  type PriceComposerConfig,
} from "./price-composer";

const CONFIG: PriceComposerConfig = {
  minOdds: 5,
  maxOdds: 15,
  minLegs: 2,
  maxLegs: 8,
  maxPerCompetition: 3,
  // Le plancher porte sur le coupon entier, pas sur la jambe : huit jambes
  // taxées 4 % rendent 0,96^8 = 0,72. Un plancher exprimé par jambe cacherait
  // que chaque jambe ajoutée coûte une multiplication de plus.
  minExpectedReturn: 0.7,
};

function leg(
  fixtureId: string,
  odds: number,
  expectedReturn: number,
  competition = "L1",
  market = "OVER_UNDER",
): PriceCandidate {
  return {
    fixtureId,
    competition,
    market,
    pick: "OVER",
    odds,
    expectedReturn,
  };
}

describe("composeByPrice", () => {
  it("refuse un bassin vide", () => {
    const result = composeByPrice([], CONFIG);
    expect(result).toEqual({
      outcome: "refused",
      reason: "no_candidates",
      bestExpectedReturn: null,
    });
  });

  it("écarte les jambes dont le prix est inexploitable", () => {
    const result = composeByPrice(
      [leg("1", 1, 0.96), leg("2", Number.NaN, 0.96), leg("3", 1.5, 0)],
      CONFIG,
    );
    expect(result.outcome).toBe("refused");
    if (result.outcome === "refused")
      expect(result.reason).toBe("no_candidates");
  });

  it("atteint la fourchette de cote visée", () => {
    const candidates = Array.from({ length: 8 }, (_, index) =>
      leg(`${index + 1}`, 1.35, 0.96, `C${index}`),
    );
    const result = composeByPrice(candidates, CONFIG);
    expect(result.outcome).toBe("composed");
    if (result.outcome !== "composed") return;
    expect(result.coupon.combinedOdds.toNumber()).toBeGreaterThanOrEqual(5);
    expect(result.coupon.combinedOdds.toNumber()).toBeLessThanOrEqual(15);
  });

  it("refuse quand la cible est hors d'atteinte", () => {
    // Quatre jambes à 1,10 plafonnent à 1,46 : la cote 5 est inatteignable.
    const candidates = Array.from({ length: 4 }, (_, index) =>
      leg(`${index + 1}`, 1.1, 0.98, `C${index}`),
    );
    const result = composeByPrice(candidates, CONFIG);
    expect(result.outcome).toBe("refused");
    if (result.outcome === "refused")
      expect(result.reason).toBe("target_unreachable");
  });

  it("refuse quand la meilleure combinaison reste sous le plancher", () => {
    const candidates = Array.from({ length: 8 }, (_, index) =>
      leg(`${index + 1}`, 1.35, 0.9, `C${index}`),
    );
    const result = composeByPrice(candidates, {
      ...CONFIG,
      minExpectedReturn: 0.95,
    });
    expect(result.outcome).toBe("refused");
    if (result.outcome !== "refused") return;
    expect(result.reason).toBe("expected_return_too_low");
    // Le refus dit de combien on a manqué : 0,9^n reste sous 0,95.
    expect(result.bestExpectedReturn?.toNumber()).toBeLessThan(0.95);
  });

  // Le cœur du module : à cote égale, c'est le prix mesuré qui tranche.
  it("préfère le marché le moins taxé à cote identique", () => {
    const cheap = Array.from({ length: 6 }, (_, index) =>
      leg(`${index + 1}`, 1.35, 0.97, `C${index}`, "OVER_UNDER"),
    );
    const dear = Array.from({ length: 6 }, (_, index) =>
      leg(`${index + 101}`, 1.35, 0.88, `D${index}`, "RESULT_TOTAL_GOALS"),
    );
    const result = composeByPrice([...dear, ...cheap], CONFIG);
    expect(result.outcome).toBe("composed");
    if (result.outcome !== "composed") return;
    expect(
      result.coupon.legs.every((chosen) => chosen.market === "OVER_UNDER"),
    ).toBe(true);
  });

  it("ne prend jamais deux jambes de la même rencontre", () => {
    const candidates = [
      ...Array.from({ length: 6 }, (_, index) =>
        leg("1", 1.35, 0.97, `C${index}`, `M${index}`),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        leg(`${index + 2}`, 1.35, 0.96, `C${index}`),
      ),
    ];
    const result = composeByPrice(candidates, CONFIG);
    expect(result.outcome).toBe("composed");
    if (result.outcome !== "composed") return;
    const fixtures = result.coupon.legs.map((chosen) => chosen.fixtureId);
    expect(new Set(fixtures).size).toBe(fixtures.length);
  });

  it("plafonne le nombre de jambes par championnat", () => {
    const candidates = Array.from({ length: 12 }, (_, index) =>
      leg(`${index + 1}`, 1.35, 0.97, index < 10 ? "L1" : `C${index}`),
    );
    const result = composeByPrice(candidates, {
      ...CONFIG,
      maxPerCompetition: 2,
    });
    if (result.outcome !== "composed") return;
    const perCompetition = new Map<string, number>();
    for (const chosen of result.coupon.legs) {
      perCompetition.set(
        chosen.competition,
        (perCompetition.get(chosen.competition) ?? 0) + 1,
      );
    }
    expect(Math.max(...perCompetition.values())).toBeLessThanOrEqual(2);
  });

  it("respecte le plafond de jambes", () => {
    const candidates = Array.from({ length: 20 }, (_, index) =>
      leg(`${index + 1}`, 1.2, 0.97, `C${index}`),
    );
    const result = composeByPrice(candidates, {
      ...CONFIG,
      maxLegs: 9,
      maxOdds: 40,
    });
    if (result.outcome !== "composed") return;
    expect(result.coupon.legs.length).toBeLessThanOrEqual(9);
  });

  it("rend le retour attendu comme produit exact des jambes", () => {
    const candidates = Array.from({ length: 8 }, (_, index) =>
      leg(`${index + 1}`, 1.35, 0.96, `C${index}`),
    );
    const result = composeByPrice(candidates, CONFIG);
    if (result.outcome !== "composed") return;
    const expected = result.coupon.legs.reduce(
      (product, chosen) => product * chosen.expectedReturn,
      1,
    );
    expect(result.coupon.expectedReturn.toNumber()).toBeCloseTo(expected, 12);
  });

  // Conséquence directe du plancher au niveau du coupon : chaque jambe est une
  // multiplication par un nombre < 1, donc la combinaison la moins chère qui
  // atteint la cible est toujours la plus courte.
  it("prend le moins de jambes possible pour atteindre la cible", () => {
    const candidates = Array.from({ length: 12 }, (_, index) =>
      leg(`${index + 1}`, 1.35, 0.96, `C${index}`),
    );
    const result = composeByPrice(candidates, CONFIG);
    expect(result.outcome).toBe("composed");
    if (result.outcome !== "composed") return;
    // 1,35^5 = 4,48 est sous la cible ; 1,35^6 = 6,05 l'atteint.
    expect(result.coupon.legs.length).toBe(6);
  });

  it("donne le même coupon sur deux exécutions", () => {
    const candidates = Array.from({ length: 30 }, (_, index) =>
      leg(
        `${index + 1}`,
        1.2 + (index % 7) * 0.05,
        0.94 + (index % 5) * 0.01,
        `C${index % 9}`,
      ),
    );
    const first = composeByPrice(candidates, CONFIG);
    const second = composeByPrice([...candidates].reverse(), CONFIG);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
