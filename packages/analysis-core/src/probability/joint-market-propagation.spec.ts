import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { computePoissonMarkets } from "./poisson";
import { applyH2HMarketSignalCorrection } from "./h2h-market-signal-correction";
import { applyCongestionSignalCorrection } from "./congestion-signal-correction";
import { propagateGoalMarketShift } from "./joint-market-propagation";

const SIDES = ["HOME", "DRAW", "AWAY"] as const;
const sum = (values: Decimal[]) =>
  values.reduce((acc, v) => acc.plus(v), new Decimal(0));
const close = (a: Decimal, b: Decimal) =>
  expect(a.minus(b).abs().toNumber()).toBeLessThan(1e-9);

describe("propagateGoalMarketShift", () => {
  const raw = computePoissonMarkets(1.5, 1.2);

  it("keeps RESULT_TOTAL_GOALS 2.5 and RESULT_BTTS partitions in step with a shifted over25 / bttsYes", () => {
    const shifted = {
      ...raw,
      over25: raw.over25.plus(0.05),
      under25: raw.under25.minus(0.05),
      bttsYes: raw.bttsYes.minus(0.04),
      bttsNo: raw.bttsNo.plus(0.04),
    };
    const result = propagateGoalMarketShift(raw, shifted);

    close(
      sum(SIDES.map((s) => result.resultTotalGoals[`${s}_OVER_2_5`]!)),
      shifted.over25,
    );
    close(
      sum(SIDES.map((s) => result.resultBtts[`${s}_YES`]!)),
      shifted.bttsYes,
    );
    for (const side of SIDES) {
      const mass = result[side.toLowerCase() as "home" | "draw" | "away"];
      close(
        result.resultTotalGoals[`${side}_OVER_2_5`]!.plus(
          result.resultTotalGoals[`${side}_UNDER_2_5`]!,
        ),
        mass,
      );
      close(
        result.resultBtts[`${side}_YES`]!.plus(
          result.resultBtts[`${side}_NO`]!,
        ),
        mass,
      );
    }
    // Other lines are not part of the shift and stay as they were.
    close(
      result.resultTotalGoals.HOME_OVER_3_5!,
      raw.resultTotalGoals.HOME_OVER_3_5!,
    );
  });

  it("is the identity when nothing was shifted", () => {
    const result = propagateGoalMarketShift(raw, { ...raw });
    close(
      result.resultTotalGoals.HOME_OVER_2_5!,
      raw.resultTotalGoals.HOME_OVER_2_5!,
    );
    close(result.resultBtts.AWAY_YES!, raw.resultBtts.AWAY_YES!);
    close(result.winToNilHome, raw.winToNilHome);
  });

  it("keeps win to nil under clean sheet after independent shifts", () => {
    const shifted = {
      ...raw,
      cleanSheetHome: new Decimal(0.2),
      winToNilHome: new Decimal(0.25),
    };
    const result = propagateGoalMarketShift(raw, shifted);
    expect(result.winToNilHome.lte(result.cleanSheetHome)).toBe(true);
  });
});

describe("corrections propagate their shift to the joint markets", () => {
  const raw = computePoissonMarkets(1.4, 1.1);

  it("H2H over25 / btts signals move the RESULT_TOTAL_GOALS 2.5 line and RESULT_BTTS with them", () => {
    const corrected = applyH2HMarketSignalCorrection(raw, {
      btts: 1,
      over25: 1,
      cleanSheetHome: null,
      cleanSheetAway: null,
      winToNilHome: null,
      winToNilAway: null,
    });
    expect(corrected.over25.gt(raw.over25)).toBe(true);
    close(
      sum(SIDES.map((s) => corrected.resultTotalGoals[`${s}_OVER_2_5`]!)),
      corrected.over25,
    );
    close(
      sum(SIDES.map((s) => corrected.resultBtts[`${s}_YES`]!)),
      corrected.bttsYes,
    );
  });

  it("congestion does the same", () => {
    const corrected = applyCongestionSignalCorrection(raw, 1);
    expect(corrected.over25.lt(raw.over25)).toBe(true);
    close(
      sum(SIDES.map((s) => corrected.resultTotalGoals[`${s}_OVER_2_5`]!)),
      corrected.over25,
    );
  });
});
