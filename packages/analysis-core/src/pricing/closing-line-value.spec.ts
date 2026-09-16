import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { closingLineValue, fairProbabilities } from "./closing-line-value";

const outcome = (pick: string, odds: string) => ({
  pick,
  odds: new Decimal(odds),
});

describe("fairProbabilities", () => {
  it("retire la marge : les probabilités somment à 1", () => {
    const fair = fairProbabilities([
      outcome("HOME", "2.00"),
      outcome("DRAW", "3.50"),
      outcome("AWAY", "4.00"),
    ]);
    const total = [...(fair?.values() ?? [])].reduce(
      (sum, value) => sum.plus(value),
      new Decimal(0),
    );
    expect(total.toNumber()).toBeCloseTo(1, 10);
  });

  it("garde l'ordre des favoris après normalisation", () => {
    const fair = fairProbabilities([
      outcome("HOME", "1.50"),
      outcome("DRAW", "4.00"),
      outcome("AWAY", "6.00"),
    ]);
    expect(fair?.get("HOME")?.gt(fair.get("DRAW") ?? 0)).toBe(true);
    expect(fair?.get("DRAW")?.gt(fair.get("AWAY") ?? 0)).toBe(true);
  });

  it("somme à 2 sur la double chance, dont les issues se recouvrent", () => {
    const fair = fairProbabilities(
      [outcome("1X", "1.30"), outcome("12", "1.35"), outcome("X2", "2.10")],
      2,
    );
    const total = [...(fair?.values() ?? [])].reduce(
      (sum, value) => sum.plus(value),
      new Decimal(0),
    );
    expect(total.toNumber()).toBeCloseTo(2, 10);
  });

  it("refuse un groupe incomplet ou une cote non jouable", () => {
    expect(fairProbabilities([outcome("HOME", "2.00")])).toBeNull();
    expect(
      fairProbabilities([outcome("HOME", "1.00"), outcome("AWAY", "2.00")]),
    ).toBeNull();
  });
});

describe("closingLineValue", () => {
  const takenOutcomes = [
    outcome("HOME", "2.10"),
    outcome("DRAW", "3.50"),
    outcome("AWAY", "3.80"),
  ];

  it("est positif quand le marché se resserre sur notre choix", () => {
    // Le domicile passe de 2.10 à 1.90 : le marché a fini par l'estimer plus
    // probable que ce qu'on a payé.
    const result = closingLineValue({
      takenOdds: new Decimal("2.10"),
      pick: "HOME",
      takenOutcomes,
      closingOutcomes: [
        outcome("HOME", "1.90"),
        outcome("DRAW", "3.60"),
        outcome("AWAY", "4.20"),
      ],
    });
    expect(result).not.toBeNull();
    expect(result?.value.gt(0)).toBe(true);
    expect(result?.probabilityDrift.gt(0)).toBe(true);
  });

  it("est négatif quand le marché s'éloigne de notre choix", () => {
    const result = closingLineValue({
      takenOdds: new Decimal("2.10"),
      pick: "HOME",
      takenOutcomes,
      closingOutcomes: [
        outcome("HOME", "2.60"),
        outcome("DRAW", "3.40"),
        outcome("AWAY", "2.90"),
      ],
    });
    expect(result?.value.lt(0)).toBe(true);
    expect(result?.probabilityDrift.lt(0)).toBe(true);
  });

  // Le point de la normalisation : deux books au même prix vrai mais aux
  // marges différentes ne doivent pas produire de CLV artificiel.
  it("ne confond pas un écart de marge avec de la valeur", () => {
    const serré = [
      outcome("HOME", "2.02"),
      outcome("DRAW", "3.53"),
      outcome("AWAY", "3.84"),
    ];
    const large = [
      outcome("HOME", "1.90"),
      outcome("DRAW", "3.30"),
      outcome("AWAY", "3.60"),
    ];
    const fairSerré = fairProbabilities(serré)?.get("HOME");
    const fairLarge = fairProbabilities(large)?.get("HOME");
    // Les deux books voient la même probabilité vraie à moins d'un point.
    expect(
      fairSerré
        ?.minus(fairLarge ?? 0)
        .abs()
        .toNumber(),
    ).toBeLessThan(0.01);
  });

  it("rend le CLV homogène à une espérance de gain", () => {
    // Cote 2.00 sur une issue que la clôture estime à 55 % : +10 % attendus.
    const result = closingLineValue({
      takenOdds: new Decimal("2.00"),
      pick: "YES",
      takenOutcomes: [outcome("YES", "2.00"), outcome("NO", "2.00")],
      closingOutcomes: [outcome("YES", "1.80"), outcome("NO", "2.20")],
    });
    expect(result?.closingFair.toNumber()).toBeCloseTo(0.55, 2);
    expect(result?.value.toNumber()).toBeCloseTo(0.1, 2);
  });

  it("préfère le silence à un chiffre faux", () => {
    // Groupe de clôture incomplet : un CLV calculé dessus serait biaisé dans
    // une direction inconnue.
    expect(
      closingLineValue({
        takenOdds: new Decimal("2.10"),
        pick: "HOME",
        takenOutcomes,
        closingOutcomes: [outcome("HOME", "1.90")],
      }),
    ).toBeNull();
    // Choix absent du groupe.
    expect(
      closingLineValue({
        takenOdds: new Decimal("2.10"),
        pick: "OVER",
        takenOutcomes,
        closingOutcomes: takenOutcomes,
      }),
    ).toBeNull();
  });
});
