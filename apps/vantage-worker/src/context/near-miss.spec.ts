import { describe, expect, it } from "vitest";
import { extractNearMiss } from "./near-miss";

describe("extractNearMiss", () => {
  it("extracts DOMINANT's below_threshold shape (direct probability/threshold)", () => {
    const result = extractNearMiss("DOMINANT", {
      probability: 0.42,
      odds: 1.8,
      threshold: 0.55,
      minOdds: 1.5,
    });
    expect(result).toEqual({
      values: [{ label: "annoncée", probability: 0.42 }],
      threshold: 0.55,
    });
  });

  it("extracts DOMINANT's insufficient_margin shape (regression: was previously unmatched — a real rejection reason DOMINANT emits, not covered by the below_threshold extractor)", () => {
    const result = extractNearMiss("DOMINANT", {
      margin: 0.02,
      minMargin: 0.05,
    });
    expect(result).toEqual({
      values: [{ label: "écart favori/second", probability: 0.02 }],
      threshold: 0.05,
    });
  });

  it("extracts DOMINANT's below_min_odds shape (regression: same gap as insufficient_margin)", () => {
    const result = extractNearMiss("DOMINANT", { odds: 1.1, minOdds: 1.2 });
    expect(result).toEqual({
      values: [{ label: "cote", probability: 1.1 }],
      threshold: 1.2,
    });
  });

  it("extracts VALUE/SAFE's score_below_threshold shape — {score, threshold}, not {probability, threshold} (regression: the pre-2026-08-30 extractor looked for a `probability` key that this reasonCode never has, so it silently matched nothing on VALUE/SAFE's own most common rejection)", () => {
    const result = extractNearMiss("VALUE", { score: 0.51, threshold: 0.6 });
    expect(result).toEqual({
      values: [{ label: "score modèle", probability: 0.51 }],
      threshold: 0.6,
    });
    expect(extractNearMiss("SAFE", { score: 0.4, threshold: 0.55 })).toEqual({
      values: [{ label: "score modèle", probability: 0.4 }],
      threshold: 0.55,
    });
  });

  it("extracts VALUE/SAFE's no_viable_pick/no_safe_candidate shape (bestQualityPickDetails) without inventing a threshold that was never computed", () => {
    const result = extractNearMiss("VALUE", {
      market: "OVER_UNDER",
      pick: "OVER",
      probability: 0.58,
      odds: 1.7,
      ev: -0.01,
      qualityScore: 0.4,
      edge: 0.01,
      rejectionReason: "edge_below_floor",
    });
    expect(result).toEqual({
      values: [{ label: "meilleur candidat retenu", probability: 0.58 }],
      threshold: null,
    });
  });

  it("extracts both sides for a two-sided channel (BTTS) using its real field name `threshold` (regression: the table previously used `yesThreshold`, a field btts.strategy.ts has never emitted — a stale prod-DB sample from an earlier strategy revision was mistaken for the current shape, so this silently never matched)", () => {
    const result = extractNearMiss("BTTS", {
      bttsYes: 0.31,
      bttsNo: 0.69,
      threshold: 0.35,
    });
    expect(result).toEqual({
      values: [
        { label: "Oui", probability: 0.31 },
        { label: "Non", probability: 0.69 },
      ],
      threshold: 0.35,
    });
  });

  it("extracts both sides for CLEAN_SHEET with the domicile/extérieur labels", () => {
    const result = extractNearMiss("CLEAN_SHEET", {
      cleanSheetHome: 0.3,
      cleanSheetAway: 0.22,
      threshold: 0.4,
    });
    expect(result?.values).toEqual([
      { label: "domicile", probability: 0.3 },
      { label: "extérieur", probability: 0.22 },
    ]);
  });

  it("extracts GOALS' below_threshold shape (direct)", () => {
    const result = extractNearMiss("GOALS", {
      probability: 0.58,
      threshold: 0.6,
    });
    expect(result).toEqual({
      values: [{ label: "annoncée", probability: 0.58 }],
      threshold: 0.6,
    });
  });

  it("extracts GOALS' no_priced_line shape (candidateLines list) when the direct shape doesn't match", () => {
    const result = extractNearMiss("GOALS", {
      candidateLines: [
        { pick: "UNDER_3_5", probability: 0.72 },
        { pick: "UNDER_4_5", probability: 0.85 },
      ],
    });
    expect(result).toEqual({
      values: [
        { label: "UNDER_3_5", probability: 0.72 },
        { label: "UNDER_4_5", probability: 0.85 },
      ],
      threshold: null,
    });
  });

  it("extracts CORRECT_SCORE's modal scoreline, no threshold", () => {
    const result = extractNearMiss("CORRECT_SCORE", {
      bestScoreline: "1:1",
      bestProbability: 0.129,
    });
    expect(result).toEqual({
      values: [{ label: "1:1", probability: 0.129 }],
      threshold: null,
    });
  });

  it("returns null for channels deliberately excluded (market_suspended gate — FIRST_HALF/OVER_UNDER_HT/HALF_TIME_FULL_TIME)", () => {
    expect(
      extractNearMiss("FIRST_HALF", { margin: 0.02, minMargin: 0.05 }),
    ).toBeNull();
    expect(extractNearMiss("OVER_UNDER_HT", {})).toBeNull();
    expect(
      extractNearMiss("HALF_TIME_FULL_TIME", {
        bestPick: "HOME_HOME",
        bestProbability: 0.2,
      }),
    ).toBeNull();
  });

  it("returns null for meta-channels (CONSENSUS/AVOID)", () => {
    expect(
      extractNearMiss("CONSENSUS", { bestLevel: 2, minLevel: 3 }),
    ).toBeNull();
    expect(extractNearMiss("AVOID", {})).toBeNull();
  });

  it("returns null on a null or non-object reasonDetails (fails closed)", () => {
    expect(extractNearMiss("VALUE", null)).toBeNull();
    expect(extractNearMiss("VALUE", "not an object")).toBeNull();
    expect(extractNearMiss("VALUE", ["array", "not", "object"])).toBeNull();
  });

  it("returns null when the payload doesn't match the expected shape (schema drift)", () => {
    expect(extractNearMiss("VALUE", { somethingElse: 1 })).toBeNull();
    expect(extractNearMiss("BTTS", { bttsYes: "not a number" })).toBeNull();
  });
});
