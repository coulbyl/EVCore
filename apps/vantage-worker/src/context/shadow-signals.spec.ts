import { describe, expect, it } from "vitest";
import { extractShadowPrediction, extractShadowMl } from "./shadow-signals";

describe("extractShadowPrediction", () => {
  it("extracts a well-formed shadow_predictions payload", () => {
    const result = extractShadowPrediction({
      shadow_predictions: {
        percent: { home: 35, draw: 28, away: 37 },
        poisson: { home: 1.6, away: 1.2 },
        winnerName: "St. Louis City",
        conflict: true,
      },
    });
    expect(result).toEqual({
      homePercent: 35,
      drawPercent: 28,
      awayPercent: 37,
      poissonHome: 1.6,
      poissonAway: 1.2,
      winnerName: "St. Louis City",
      conflict: true,
    });
  });

  it("returns null when the field is absent", () => {
    expect(extractShadowPrediction({})).toBeNull();
    expect(extractShadowPrediction(null)).toBeNull();
  });

  it("returns null when percent/poisson are malformed (fails closed)", () => {
    expect(
      extractShadowPrediction({
        shadow_predictions: { percent: {}, poisson: {} },
      }),
    ).toBeNull();
  });

  it("defaults conflict to false and winnerName to null when absent", () => {
    const result = extractShadowPrediction({
      shadow_predictions: {
        percent: { home: 40, draw: 30, away: 30 },
        poisson: { home: 1.4, away: 1.1 },
      },
    });
    expect(result?.conflict).toBe(false);
    expect(result?.winnerName).toBeNull();
  });
});

describe("extractShadowMl", () => {
  it("keeps only DOMINANT/VALUE — the two channels a 2026-08-30 calibration audit confirmed the correction actually improves", () => {
    const result = extractShadowMl({
      shadow_ml_by_channel: {
        DOMINANT: { correctedP: 0.55, edgeDelta: -0.05 },
        VALUE: { correctedP: 0.3, edgeDelta: -0.12 },
        CLEAN_SHEET: { correctedP: 0.9, edgeDelta: 0.6 },
        GOALS: { correctedP: 0.4, edgeDelta: -0.1 },
      },
    });
    expect(result).toEqual([
      { channel: "DOMINANT", correctedP: 0.55, edgeDelta: -0.05 },
      { channel: "VALUE", correctedP: 0.3, edgeDelta: -0.12 },
    ]);
  });

  it("returns an empty array when the field is absent", () => {
    expect(extractShadowMl({})).toEqual([]);
  });

  it("skips a channel entry with a malformed shape", () => {
    const result = extractShadowMl({
      shadow_ml_by_channel: { DOMINANT: { correctedP: "not a number" } },
    });
    expect(result).toEqual([]);
  });

  it("rejects an out-of-[0,1] correctedP (CLAUDE.md: probabilities must be asserted at ingestion) even though it's a finite number", () => {
    const result = extractShadowMl({
      shadow_ml_by_channel: { DOMINANT: { correctedP: 1.5, edgeDelta: 0.1 } },
    });
    expect(result).toEqual([]);
  });
});
