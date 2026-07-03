import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { computePoissonMarkets } from "./poisson";
import {
  getOverUnderShrinkageConfig,
  shrinkOverUnderProbabilities,
} from "./ou-shrinkage";

const NOR2 = getOverUnderShrinkageConfig("NOR2")!;

describe("shrinkOverUnderProbabilities", () => {
  it("is the identity without a config (rich-data leagues untouched)", () => {
    const probabilities = computePoissonMarkets(1.4, 1.2);
    expect(shrinkOverUnderProbabilities(probabilities, null)).toBe(
      probabilities,
    );
    expect(getOverUnderShrinkageConfig("PL")).toBeNull();
    expect(getOverUnderShrinkageConfig(null)).toBeNull();
  });

  it("shrinks toward the base rate with the configured factor", () => {
    const probabilities = computePoissonMarkets(1.0, 0.8);
    const shrunk = shrinkOverUnderProbabilities(probabilities, NOR2);

    // over' = base + factor × (over − base), checked on the 2.5 line.
    const expected = new Decimal(NOR2.baseRates.over25).plus(
      new Decimal(NOR2.factor).times(
        probabilities.over25.minus(NOR2.baseRates.over25),
      ),
    );
    expect(shrunk.over25.toNumber()).toBeCloseTo(expected.toNumber(), 12);
    // A low-λ match's raw under35 conviction is pulled down toward the
    // league reality (Argentina/NOR2 failure mode).
    expect(shrunk.under35.lessThan(probabilities.under35)).toBe(true);
  });

  it("keeps over/under complements coherent and probabilities in [0, 1]", () => {
    const probabilities = computePoissonMarkets(3.4, 1.1);
    const shrunk = shrinkOverUnderProbabilities(probabilities, NOR2);

    for (const line of ["15", "25", "35", "45"] as const) {
      const over = shrunk[`over${line}`];
      const under = shrunk[`under${line}`];
      expect(over.plus(under).toNumber()).toBeCloseTo(1, 12);
      expect(over.greaterThanOrEqualTo(0)).toBe(true);
      expect(over.lessThanOrEqualTo(1)).toBe(true);
    }
  });

  it("caps NOR2 under35 conviction below the old noise gate", () => {
    // Even a model certain of a closed game (λ → 0) cannot claim more than
    // 1 − base×(1−factor) ≈ 0.68 under 3.5 in NOR2.
    const probabilities = computePoissonMarkets(0.1, 0.1);
    const shrunk = shrinkOverUnderProbabilities(probabilities, NOR2);
    expect(shrunk.under35.toNumber()).toBeLessThan(0.69);
    expect(shrunk.under35.toNumber()).toBeGreaterThan(0.6);
  });

  it("leaves 1X2, BTTS and half-time markets untouched", () => {
    const probabilities = computePoissonMarkets(1.4, 1.2);
    const shrunk = shrinkOverUnderProbabilities(probabilities, NOR2);
    expect(shrunk.home).toBe(probabilities.home);
    expect(shrunk.draw).toBe(probabilities.draw);
    expect(shrunk.away).toBe(probabilities.away);
    expect(shrunk.bttsYes).toBe(probabilities.bttsYes);
    expect(shrunk.ouHT).toBe(probabilities.ouHT);
  });
});
