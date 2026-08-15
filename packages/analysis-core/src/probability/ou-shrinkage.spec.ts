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
    const expected = new Decimal(NOR2.baseRates!.over25).plus(
      new Decimal(NOR2.factor!).times(
        probabilities.over25.minus(NOR2.baseRates!.over25),
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

  it("shrinks BTTS and HT O/U with their own measured factors and bases", () => {
    const probabilities = computePoissonMarkets(1.0, 0.8);
    const shrunk = shrinkOverUnderProbabilities(probabilities, NOR2);

    const btts = NOR2.btts!;
    const expectedBtts = new Decimal(btts.baseYes).plus(
      new Decimal(btts.factor).times(probabilities.bttsYes.minus(btts.baseYes)),
    );
    expect(shrunk.bttsYes.toNumber()).toBeCloseTo(expectedBtts.toNumber(), 12);
    expect(shrunk.bttsYes.plus(shrunk.bttsNo).toNumber()).toBeCloseTo(1, 12);

    const ouHt = NOR2.ouHt!;
    const rawOver05 = probabilities.ouHT.OVER_0_5!;
    const expectedOver05 = new Decimal(ouHt.base05).plus(
      new Decimal(ouHt.factor05).times(rawOver05.minus(ouHt.base05)),
    );
    expect(shrunk.ouHT.OVER_0_5!.toNumber()).toBeCloseTo(
      expectedOver05.toNumber(),
      12,
    );
    expect(
      shrunk.ouHT.OVER_1_5!.plus(shrunk.ouHT.UNDER_1_5!).toNumber(),
    ).toBeCloseTo(1, 12);
  });

  it("shrinks TEAM_TOTAL_HOME/AWAY independently per side when configured", () => {
    // NOR2 has no teamTotal block yet (pending the calibration backtest) —
    // this exercises the mechanism with a synthetic config, same shape a
    // future backtest-derived entry would have.
    const probabilities = computePoissonMarkets(1.9, 0.7);
    const config = {
      ...NOR2,
      teamTotalHome: { "15": { factor: 0.3, base: 0.55 } },
      teamTotalAway: { "15": { factor: 0.5, base: 0.3 } },
    };
    const shrunk = shrinkOverUnderProbabilities(probabilities, config);

    const rawHomeOver15 = probabilities.teamTotalHome.OVER_1_5!;
    const expectedHomeOver15 = new Decimal(0.55).plus(
      new Decimal(0.3).times(rawHomeOver15.minus(0.55)),
    );
    expect(shrunk.teamTotalHome.OVER_1_5!.toNumber()).toBeCloseTo(
      expectedHomeOver15.toNumber(),
      12,
    );
    expect(
      shrunk.teamTotalHome
        .OVER_1_5!.plus(shrunk.teamTotalHome.UNDER_1_5!)
        .toNumber(),
    ).toBeCloseTo(1, 12);

    const rawAwayOver15 = probabilities.teamTotalAway.OVER_1_5!;
    const expectedAwayOver15 = new Decimal(0.3).plus(
      new Decimal(0.5).times(rawAwayOver15.minus(0.3)),
    );
    expect(shrunk.teamTotalAway.OVER_1_5!.toNumber()).toBeCloseTo(
      expectedAwayOver15.toNumber(),
      12,
    );

    // Lines without a config entry (e.g. 2.5) are left untouched.
    expect(shrunk.teamTotalHome.OVER_2_5).toBe(
      probabilities.teamTotalHome.OVER_2_5,
    );
  });

  it("does not touch teamTotal when the config has no teamTotal block", () => {
    const probabilities = computePoissonMarkets(1.4, 1.2);
    // A minimal config with only the full O/U fields, no teamTotal block —
    // NOR2 itself now ships one (2026-08-15 calibration pass), so it can't
    // be reused here to exercise the "no teamTotal block" path.
    const config = { factor: NOR2.factor, baseRates: NOR2.baseRates };
    const shrunk = shrinkOverUnderProbabilities(probabilities, config);
    expect(shrunk.teamTotalHome).toBe(probabilities.teamTotalHome);
    expect(shrunk.teamTotalAway).toBe(probabilities.teamTotalAway);
  });

  it("leaves full-time O/U untouched for a league with only a teamTotal block (no factor/baseRates)", () => {
    // 2026-08-15 TEAM_TOTAL calibration pass added leagues with no prior
    // full O/U measurement — factor/baseRates are optional precisely for
    // this case.
    const probabilities = computePoissonMarkets(1.6, 0.9);
    const config = {
      teamTotalHome: { "15": { factor: 0.4, base: 0.5 } },
    };
    const shrunk = shrinkOverUnderProbabilities(probabilities, config);

    expect(shrunk.over25).toBe(probabilities.over25);
    expect(shrunk.under25).toBe(probabilities.under25);
    expect(shrunk.teamTotalHome.OVER_1_5).not.toBe(
      probabilities.teamTotalHome.OVER_1_5,
    );
  });

  it("never mutates the input probabilities object", () => {
    // Regression: an earlier draft of the optional factor/baseRates guard
    // aliased `result` to the input `probabilities` when no full O/U block
    // was configured, so the btts/ouHt/teamTotal writes below it mutated the
    // caller's object in place.
    const probabilities = computePoissonMarkets(1.6, 0.9);
    const snapshotBefore = probabilities.teamTotalHome.OVER_1_5;
    const config = {
      teamTotalHome: { "15": { factor: 0.4, base: 0.5 } },
    };
    shrinkOverUnderProbabilities(probabilities, config);
    expect(probabilities.teamTotalHome.OVER_1_5).toBe(snapshotBefore);
  });

  it("shrinks RESULT_TOTAL_GOALS by shrinking the UNDER joint probability, deriving OVER from the side mass", () => {
    // RESULT_TOTAL_GOALS's complement is over(side) = oneXTwo[side] -
    // under(side), NOT 1 - under — unlike full O/U and TEAM_TOTAL. This test
    // pins that behavior down explicitly.
    const probabilities = computePoissonMarkets(1.5, 1.0);
    const config = {
      resultTotalGoals: {
        HOME: { "15": { factor: 0.4, base: 0.15 } },
      },
    };
    const shrunk = shrinkOverUnderProbabilities(probabilities, config);

    const rawUnder = probabilities.resultTotalGoals.HOME_UNDER_1_5!;
    const expectedUnder = new Decimal(0.15).plus(
      new Decimal(0.4).times(rawUnder.minus(0.15)),
    );
    expect(shrunk.resultTotalGoals.HOME_UNDER_1_5!.toNumber()).toBeCloseTo(
      expectedUnder.toNumber(),
      12,
    );

    const expectedOver = probabilities.home.minus(expectedUnder);
    expect(shrunk.resultTotalGoals.HOME_OVER_1_5!.toNumber()).toBeCloseTo(
      expectedOver.toNumber(),
      12,
    );
    // Under + over for this side/line must still sum to that side's own win
    // probability, not to 1.
    expect(
      shrunk.resultTotalGoals
        .HOME_UNDER_1_5!.plus(shrunk.resultTotalGoals.HOME_OVER_1_5!)
        .toNumber(),
    ).toBeCloseTo(probabilities.home.toNumber(), 12);

    // DRAW/AWAY and other lines are untouched.
    expect(shrunk.resultTotalGoals.HOME_OVER_2_5).toBe(
      probabilities.resultTotalGoals.HOME_OVER_2_5,
    );
    expect(shrunk.resultTotalGoals.AWAY_UNDER_1_5).toBe(
      probabilities.resultTotalGoals.AWAY_UNDER_1_5,
    );
  });

  it("does not touch resultTotalGoals when the config has no resultTotalGoals block", () => {
    const probabilities = computePoissonMarkets(1.4, 1.2);
    const config = { factor: NOR2.factor, baseRates: NOR2.baseRates };
    const shrunk = shrinkOverUnderProbabilities(probabilities, config);
    expect(shrunk.resultTotalGoals).toBe(probabilities.resultTotalGoals);
  });

  it("leaves 1X2, HT/FT and First-Half Winner untouched (not measured)", () => {
    const probabilities = computePoissonMarkets(1.4, 1.2);
    const shrunk = shrinkOverUnderProbabilities(probabilities, NOR2);
    expect(shrunk.home).toBe(probabilities.home);
    expect(shrunk.draw).toBe(probabilities.draw);
    expect(shrunk.away).toBe(probabilities.away);
    expect(shrunk.htft).toBe(probabilities.htft);
    expect(shrunk.firstHalfWinner).toBe(probabilities.firstHalfWinner);
  });

  it("shrinks CLEAN_SHEET/WIN_EITHER_HALF independently per side, home and away are not complements", () => {
    const ARG1 = getOverUnderShrinkageConfig("ARG1")!;
    expect(ARG1.cleanSheetAway).toBeUndefined();

    const probabilities = computePoissonMarkets(1.4, 1.2);
    const shrunk = shrinkOverUnderProbabilities(probabilities, ARG1);

    const expectedCleanSheetHome = new Decimal(ARG1.cleanSheetHome!.base).plus(
      new Decimal(ARG1.cleanSheetHome!.factor).times(
        probabilities.cleanSheetHome.minus(ARG1.cleanSheetHome!.base),
      ),
    );
    expect(shrunk.cleanSheetHome.toNumber()).toBeCloseTo(
      expectedCleanSheetHome.toNumber(),
      12,
    );
    // No cleanSheetAway block for ARG1 — left untouched.
    expect(shrunk.cleanSheetAway).toBe(probabilities.cleanSheetAway);

    const expectedWinEitherHalfHome = new Decimal(
      ARG1.winEitherHalfHome!.base,
    ).plus(
      new Decimal(ARG1.winEitherHalfHome!.factor).times(
        probabilities.winEitherHalfHome.minus(ARG1.winEitherHalfHome!.base),
      ),
    );
    const expectedWinEitherHalfAway = new Decimal(
      ARG1.winEitherHalfAway!.base,
    ).plus(
      new Decimal(ARG1.winEitherHalfAway!.factor).times(
        probabilities.winEitherHalfAway.minus(ARG1.winEitherHalfAway!.base),
      ),
    );
    expect(shrunk.winEitherHalfHome.toNumber()).toBeCloseTo(
      expectedWinEitherHalfHome.toNumber(),
      12,
    );
    expect(shrunk.winEitherHalfAway.toNumber()).toBeCloseTo(
      expectedWinEitherHalfAway.toNumber(),
      12,
    );
  });

  it("does not touch cleanSheet/winEitherHalf when the config has no such block", () => {
    const probabilities = computePoissonMarkets(1.4, 1.2);
    const config = { factor: NOR2.factor, baseRates: NOR2.baseRates };
    const shrunk = shrinkOverUnderProbabilities(probabilities, config);
    expect(shrunk.cleanSheetHome).toBe(probabilities.cleanSheetHome);
    expect(shrunk.cleanSheetAway).toBe(probabilities.cleanSheetAway);
    expect(shrunk.winEitherHalfHome).toBe(probabilities.winEitherHalfHome);
    expect(shrunk.winEitherHalfAway).toBe(probabilities.winEitherHalfAway);
  });
});
