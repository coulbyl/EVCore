import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { computePoissonMarkets } from "./poisson";
import {
  H2H_MARKET_SIGNAL_DELTAS,
  applyH2HMarketSignalCorrection,
  logit,
  sigmoid,
} from "./h2h-market-signal-correction";

const NO_SIGNALS = {
  btts: null,
  over25: null,
  cleanSheetHome: null,
  cleanSheetAway: null,
  winToNilHome: null,
  winToNilAway: null,
};

describe("logit/sigmoid", () => {
  it("are inverses of each other", () => {
    const p = new Decimal("0.27");
    expect(sigmoid(logit(p)).toNumber()).toBeCloseTo(p.toNumber(), 10);
  });
});

describe("applyH2HMarketSignalCorrection", () => {
  it("leaves every market untouched when all signals are null", () => {
    const probabilities = computePoissonMarkets(1.4, 1.2);
    const corrected = applyH2HMarketSignalCorrection(probabilities, NO_SIGNALS);

    expect(corrected.bttsYes.toNumber()).toBeCloseTo(
      probabilities.bttsYes.toNumber(),
      12,
    );
    expect(corrected.over25.toNumber()).toBeCloseTo(
      probabilities.over25.toNumber(),
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

  it("is the identity when a signal equals 0.5 (neutral H2H history)", () => {
    const probabilities = computePoissonMarkets(1.6, 0.9);
    const corrected = applyH2HMarketSignalCorrection(probabilities, {
      ...NO_SIGNALS,
      btts: 0.5,
      cleanSheetHome: 0.5,
    });

    expect(corrected.bttsYes.toNumber()).toBeCloseTo(
      probabilities.bttsYes.toNumber(),
      10,
    );
    expect(corrected.cleanSheetHome.toNumber()).toBeCloseTo(
      probabilities.cleanSheetHome.toNumber(),
      10,
    );
  });

  it("shifts BTTS toward a high H2H signal, matching the closed-form logit-shift", () => {
    const probabilities = computePoissonMarkets(1.4, 1.2);
    const signal = 0.9;
    const corrected = applyH2HMarketSignalCorrection(probabilities, {
      ...NO_SIGNALS,
      btts: signal,
    });

    const expected = sigmoid(
      logit(probabilities.bttsYes).plus(
        new Decimal(H2H_MARKET_SIGNAL_DELTAS.btts).times(signal - 0.5),
      ),
    );
    expect(corrected.bttsYes.toNumber()).toBeCloseTo(expected.toNumber(), 10);
    expect(corrected.bttsYes.greaterThan(probabilities.bttsYes)).toBe(true);
  });

  it("keeps BTTS and OVER 2.5 complements coherent after correction", () => {
    const probabilities = computePoissonMarkets(2.1, 0.6);
    const corrected = applyH2HMarketSignalCorrection(probabilities, {
      ...NO_SIGNALS,
      btts: 0.1,
      over25: 0.85,
    });

    expect(corrected.bttsYes.plus(corrected.bttsNo).toNumber()).toBeCloseTo(
      1,
      12,
    );
    expect(corrected.over25.plus(corrected.under25).toNumber()).toBeCloseTo(
      1,
      12,
    );
  });

  it("stays within [0, 1] for extreme signals on a low-probability market", () => {
    const probabilities = computePoissonMarkets(0.3, 0.2);
    const corrected = applyH2HMarketSignalCorrection(probabilities, {
      ...NO_SIGNALS,
      winToNilHome: 1,
      winToNilAway: 0,
    });

    expect(corrected.winToNilHome.greaterThanOrEqualTo(0)).toBe(true);
    expect(corrected.winToNilHome.lessThanOrEqualTo(1)).toBe(true);
    expect(corrected.winToNilAway.greaterThanOrEqualTo(0)).toBe(true);
    expect(corrected.winToNilAway.lessThanOrEqualTo(1)).toBe(true);
  });

  it("corrects clean sheet home/away independently without touching each other", () => {
    const probabilities = computePoissonMarkets(1.1, 1.3);
    const corrected = applyH2HMarketSignalCorrection(probabilities, {
      ...NO_SIGNALS,
      cleanSheetHome: 0.9,
    });

    expect(
      corrected.cleanSheetHome.greaterThan(probabilities.cleanSheetHome),
    ).toBe(true);
    expect(corrected.cleanSheetAway.toNumber()).toBeCloseTo(
      probabilities.cleanSheetAway.toNumber(),
      12,
    );
  });

  it("passes through every unrelated field unchanged", () => {
    const probabilities = computePoissonMarkets(1.4, 1.2);
    const corrected = applyH2HMarketSignalCorrection(probabilities, {
      ...NO_SIGNALS,
      btts: 0.8,
    });

    expect(corrected.home.toNumber()).toBeCloseTo(
      probabilities.home.toNumber(),
      12,
    );
    expect(corrected.draw.toNumber()).toBeCloseTo(
      probabilities.draw.toNumber(),
      12,
    );
    expect(corrected.resultTotalGoals).toBe(probabilities.resultTotalGoals);
    expect(corrected.resultBtts).toBe(probabilities.resultBtts);
  });
});
