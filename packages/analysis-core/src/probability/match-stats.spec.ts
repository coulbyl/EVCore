import { describe, expect, it } from "vitest";
import { deriveLambdas, type LambdaConfig } from "./match-stats";

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
