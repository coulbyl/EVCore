import { describe, expect, it } from "vitest";
import {
  computeDataCoverage,
  extractEvaContextFromFeatures,
  extractModelRunFeatureDiagnostics,
  hasCalibrationAlert,
  readShadowConflict,
} from "./model-run-features";

describe("extractEvaContextFromFeatures", () => {
  it("returns the empty context for missing/invalid features", () => {
    expect(extractEvaContextFromFeatures(null).predictionSource).toBeNull();
    expect(extractEvaContextFromFeatures(undefined).evaluatedPicks).toEqual(
      [],
    );
    expect(extractEvaContextFromFeatures("not an object").lambdaHome).toBeNull();
  });

  it("reads the flat scalar fields", () => {
    const context = extractEvaContextFromFeatures({
      predictionSource: "POISSON_MAIN",
      fallbackReason: "no_odds",
      lambdaHome: 1.4,
      lambdaAway: 0.9,
      hasMarketOdds: true,
      hasPinnacleOdds: false,
      shadow_lineMovement: 0.1,
      shadow_h2h: 0.2,
      shadow_congestion: 0.3,
    });
    expect(context.predictionSource).toBe("POISSON_MAIN");
    expect(context.fallbackReason).toBe("no_odds");
    expect(context.lambdaHome).toBe(1.4);
    expect(context.lambdaAway).toBe(0.9);
    expect(context.hasMarketOdds).toBe(true);
    expect(context.hasPinnacleOdds).toBe(false);
    expect(context.shadowLineMovement).toBe(0.1);
    expect(context.shadowH2h).toBe(0.2);
    expect(context.shadowCongestion).toBe(0.3);
  });

  it("ignores an unrecognised predictionSource rather than passing it through", () => {
    const context = extractEvaContextFromFeatures({
      predictionSource: "SOMETHING_ELSE",
    });
    expect(context.predictionSource).toBeNull();
  });

  it("reads a well-formed offensiveBalance and drops a malformed one", () => {
    const good = extractEvaContextFromFeatures({
      offensiveBalance: { ratio: 0.7, classification: "BALANCED" },
    });
    expect(good.offensiveBalance).toEqual({
      ratio: 0.7,
      classification: "BALANCED",
    });

    const bad = extractEvaContextFromFeatures({
      offensiveBalance: { ratio: 0.7, classification: "UNKNOWN" },
    });
    expect(bad.offensiveBalance).toBeNull();
  });

  it("reads evaluatedPicks, skipping malformed entries", () => {
    const context = extractEvaContextFromFeatures({
      evaluatedPicks: [
        {
          market: "ONE_X_TWO",
          pick: "HOME",
          probability: 0.6,
          odds: 1.8,
          ev: 0.08,
          status: "viable",
        },
        { market: "ONE_X_TWO" }, // missing required fields — dropped
        {
          market: "BTTS",
          pick: "YES",
          probability: 0.5,
          odds: 1.9,
          ev: -0.05,
          status: "rejected",
          rejectionReason: "probability_too_low",
        },
      ],
    });
    expect(context.evaluatedPicks).toHaveLength(2);
    expect(context.evaluatedPicks[1]?.rejectionReason).toBe(
      "probability_too_low",
    );
  });
});

describe("hasCalibrationAlert", () => {
  it("is false for missing/empty features", () => {
    expect(hasCalibrationAlert(null)).toBe(false);
    expect(hasCalibrationAlert({})).toBe(false);
  });

  it("is true when calibration_alert is a non-null object", () => {
    expect(hasCalibrationAlert({ calibration_alert: { drift: 0.1 } })).toBe(
      true,
    );
  });

  it("is true when calibration_alert_over_under is a non-empty array", () => {
    expect(
      hasCalibrationAlert({ calibration_alert_over_under: [{ line: 2.5 }] }),
    ).toBe(true);
  });

  it("is false when calibration_alert_over_under is an empty array", () => {
    expect(hasCalibrationAlert({ calibration_alert_over_under: [] })).toBe(
      false,
    );
  });
});

describe("readShadowConflict", () => {
  it("returns null when shadow_predictions is missing", () => {
    expect(readShadowConflict({})).toBeNull();
  });

  it("reads the boolean conflict flag", () => {
    expect(
      readShadowConflict({ shadow_predictions: { conflict: true } }),
    ).toBe(true);
    expect(
      readShadowConflict({ shadow_predictions: { conflict: false } }),
    ).toBe(false);
  });

  it("returns null for a malformed conflict value", () => {
    expect(
      readShadowConflict({ shadow_predictions: { conflict: "yes" } }),
    ).toBeNull();
  });
});

describe("computeDataCoverage", () => {
  it("is 0 when no shadow signal is present", () => {
    expect(computeDataCoverage({})).toBe(0);
  });

  it("is 1 when all three shadow signals are present", () => {
    expect(
      computeDataCoverage({
        shadow_lineMovement: 0.1,
        shadow_h2h: 0.2,
        shadow_congestion: 0.3,
      }),
    ).toBe(1);
  });

  it("is a fraction when only some signals are present", () => {
    expect(computeDataCoverage({ shadow_h2h: 0.2 })).toBeCloseTo(1 / 3, 10);
  });
});

describe("extractModelRunFeatureDiagnostics", () => {
  it("returns the empty diagnostics for missing/invalid features", () => {
    const diagnostics = extractModelRunFeatureDiagnostics(null);
    expect(diagnostics.candidatePicks).toEqual([]);
    expect(diagnostics.evaluatedPicks).toEqual([]);
    expect(diagnostics.lambdaHome).toBeNull();
  });

  it("formats lambda/expectedTotalGoals to 2 decimals", () => {
    const diagnostics = extractModelRunFeatureDiagnostics({
      lambdaHome: 1.456,
      lambdaAway: 0.944,
    });
    expect(diagnostics.lambdaHome).toBe("1.46");
    expect(diagnostics.lambdaAway).toBe("0.94");
    expect(diagnostics.expectedTotalGoals).toBe("2.40");
  });

  it("formats candidatePicks, signing EV explicitly", () => {
    const diagnostics = extractModelRunFeatureDiagnostics({
      candidatePicks: [
        {
          market: "ONE_X_TWO",
          pick: "HOME",
          probability: 0.612,
          odds: 1.83,
          ev: 0.0801,
          qualityScore: 0.7,
        },
        {
          market: "BTTS",
          pick: "NO",
          probability: 0.4,
          odds: 2.1,
          ev: -0.02,
          qualityScore: 0.5,
        },
      ],
    });
    expect(diagnostics.candidatePicks).toEqual([
      {
        market: "ONE_X_TWO",
        pick: "HOME",
        probability: "0.6120",
        odds: "1.83",
        ev: "+0.0801",
        qualityScore: "0.7000",
      },
      {
        market: "BTTS",
        pick: "NO",
        probability: "0.4000",
        odds: "2.10",
        ev: "-0.0200",
        qualityScore: "0.5000",
      },
    ]);
  });

  it("drops an evaluatedPicks entry with an invalid status", () => {
    const diagnostics = extractModelRunFeatureDiagnostics({
      evaluatedPicks: [
        {
          market: "ONE_X_TWO",
          pick: "HOME",
          probability: 0.6,
          odds: 1.8,
          ev: 0.08,
          qualityScore: 0.7,
          status: "not_a_real_status",
        },
      ],
    });
    expect(diagnostics.evaluatedPicks).toEqual([]);
  });

  it("carries a rejectionReason only when present", () => {
    const diagnostics = extractModelRunFeatureDiagnostics({
      evaluatedPicks: [
        {
          market: "ONE_X_TWO",
          pick: "HOME",
          probability: 0.6,
          odds: 1.8,
          ev: 0.08,
          qualityScore: 0.7,
          status: "rejected",
          rejectionReason: "under_high_lambda",
        },
      ],
    });
    expect(diagnostics.evaluatedPicks[0]).toMatchObject({
      status: "rejected",
      rejectionReason: "under_high_lambda",
    });
  });
});
