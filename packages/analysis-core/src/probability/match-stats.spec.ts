import { describe, expect, it } from "vitest";
import {
  computeOffensiveBalance,
  deriveLambdas,
  type LambdaConfig,
} from "./match-stats";

const STATS = {
  recentForm: 0.5,
  xgFor: 1.4,
  xgAgainst: 1.2,
  homeWinRate: 0.45,
  awayWinRate: 0.3,
  drawRate: 0.27,
  leagueVolatility: 1,
};

const BASE: LambdaConfig = {
  meanLambda: 1.3,
  homeAdvFactor: 1.1,
  awayDisadvFactor: 0.9,
};

describe("deriveLambdas — lambdaScale", () => {
  it("defaults to no change when lambdaScale is absent", () => {
    const a = deriveLambdas(STATS, STATS, BASE);
    const b = deriveLambdas(STATS, STATS, { ...BASE, lambdaScale: 1 });
    expect(a.home).toBeCloseTo(b.home, 10);
    expect(a.away).toBeCloseTo(b.away, 10);
  });

  it("scales both lambdas by the per-league factor (below the clamp ceiling)", () => {
    const base = deriveLambdas(STATS, STATS, BASE);
    const scaled = deriveLambdas(STATS, STATS, { ...BASE, lambdaScale: 1.1 });
    expect(scaled.home).toBeCloseTo(base.home * 1.1, 10);
    expect(scaled.away).toBeCloseTo(base.away * 1.1, 10);
  });
});

describe("computeOffensiveBalance", () => {
  it("returns ratio 1 and BALANCED for equal lambdas", () => {
    const result = computeOffensiveBalance(1.5, 1.5);
    expect(result.ratio).toBe(1);
    expect(result.classification).toBe("BALANCED");
  });

  it("is symmetric — argument order doesn't matter", () => {
    const a = computeOffensiveBalance(2.0, 0.5);
    const b = computeOffensiveBalance(0.5, 2.0);
    expect(a.ratio).toBeCloseTo(b.ratio, 10);
    expect(a.classification).toBe(b.classification);
  });

  it("classifies BALANCED at exactly the 0.5 boundary", () => {
    expect(computeOffensiveBalance(1.0, 0.5).classification).toBe("BALANCED");
  });

  it("classifies ASYMMETRIC between 0.25 and 0.5", () => {
    const result = computeOffensiveBalance(1.0, 0.3);
    expect(result.ratio).toBeCloseTo(0.3, 10);
    expect(result.classification).toBe("ASYMMETRIC");
  });

  it("classifies STRONGLY_ASYMMETRIC below 0.25", () => {
    const result = computeOffensiveBalance(2.0, 0.2);
    expect(result.ratio).toBeCloseTo(0.1, 10);
    expect(result.classification).toBe("STRONGLY_ASYMMETRIC");
  });

  it("treats two zero lambdas as perfectly balanced (no division by zero)", () => {
    const result = computeOffensiveBalance(0, 0);
    expect(result.ratio).toBe(1);
    expect(result.classification).toBe("BALANCED");
  });

  it("handles one team with zero attacking output as maximally asymmetric", () => {
    const result = computeOffensiveBalance(1.5, 0);
    expect(result.ratio).toBe(0);
    expect(result.classification).toBe("STRONGLY_ASYMMETRIC");
  });
});
