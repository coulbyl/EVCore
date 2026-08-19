import { describe, expect, it } from "vitest";
import {
  getLeagueHomeAwayFactors,
  getLeagueLambdaScale,
  getLeagueMeanLambda,
  HOME_ADVANTAGE_LAMBDA_FACTOR,
  AWAY_DISADVANTAGE_LAMBDA_FACTOR,
} from "./league-lambda-config";

// Moved 2026-08-19 from apps/backend/.../ev.constants.spec.ts — the config
// itself moved here (same category as OU_SHRINKAGE_CONFIG, calibrates the
// shared probability every channel reads rather than a staking decision).
describe("getLeagueMeanLambda", () => {
  it("returns the BL1 mean-lambda anchor", () => {
    expect(getLeagueMeanLambda("BL1")).toBe(1.7);
  });

  it("returns the global default for an unmapped league", () => {
    expect(getLeagueMeanLambda("UNKNOWN")).toBe(1.4);
  });
});

describe("getLeagueHomeAwayFactors", () => {
  it("returns the reduced home-advantage override for D2", () => {
    expect(getLeagueHomeAwayFactors("D2")).toEqual([1.02, 0.98]);
  });

  it("returns the global default for an unmapped league", () => {
    expect(getLeagueHomeAwayFactors("UNKNOWN")).toEqual([
      HOME_ADVANTAGE_LAMBDA_FACTOR,
      AWAY_DISADVANTAGE_LAMBDA_FACTOR,
    ]);
  });
});

describe("getLeagueLambdaScale", () => {
  it("returns the BL1 goal-level correction", () => {
    expect(getLeagueLambdaScale("BL1")).toBe(1.1);
  });

  it("returns 1 (no-op) for an unmapped league", () => {
    expect(getLeagueLambdaScale("UNKNOWN")).toBe(1);
  });
});
