import { describe, expect, it } from "vitest";
import { computePoissonMarkets } from "./poisson";
import {
  CONGESTION_SIGNAL_DELTA,
  applyCongestionSignalCorrection,
} from "./congestion-signal-correction";

describe("applyCongestionSignalCorrection", () => {
  it("is the identity when the congestion score is neutral (0.5)", () => {
    const probabilities = computePoissonMarkets(1.6, 0.9);
    const corrected = applyCongestionSignalCorrection(probabilities, 0.5);

    expect(corrected.over25.toNumber()).toBeCloseTo(
      probabilities.over25.toNumber(),
      10,
    );
    expect(corrected.bttsYes.toNumber()).toBeCloseTo(
      probabilities.bttsYes.toNumber(),
      10,
    );
  });

  it("shifts OVER 2.5 and BTTS down as congestion rises (negative delta)", () => {
    expect(CONGESTION_SIGNAL_DELTA).toBeLessThan(0);
    const probabilities = computePoissonMarkets(1.4, 1.2);
    const rested = applyCongestionSignalCorrection(probabilities, 0);
    const congested = applyCongestionSignalCorrection(probabilities, 1);

    expect(congested.over25.lessThan(rested.over25)).toBe(true);
    expect(congested.bttsYes.lessThan(rested.bttsYes)).toBe(true);
  });

  it("keeps OVER 2.5 and BTTS as a two-way split with their complements", () => {
    const probabilities = computePoissonMarkets(1.5, 1.1);
    const corrected = applyCongestionSignalCorrection(probabilities, 0.8);

    expect(corrected.over25.plus(corrected.under25).toNumber()).toBeCloseTo(
      1,
      10,
    );
    expect(corrected.bttsYes.plus(corrected.bttsNo).toNumber()).toBeCloseTo(
      1,
      10,
    );
  });

  it("leaves every other market untouched", () => {
    const probabilities = computePoissonMarkets(1.4, 1.2);
    const corrected = applyCongestionSignalCorrection(probabilities, 0.9);

    expect(corrected.home.toNumber()).toBeCloseTo(
      probabilities.home.toNumber(),
      12,
    );
    expect(corrected.cleanSheetHome.toNumber()).toBeCloseTo(
      probabilities.cleanSheetHome.toNumber(),
      12,
    );
    expect(corrected.winToNilAway.toNumber()).toBeCloseTo(
      probabilities.winToNilAway.toNumber(),
      12,
    );
  });
});
