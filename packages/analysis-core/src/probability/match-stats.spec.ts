import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  computeOffensiveBalance,
  deriveLambdas,
  getLeagueThreeWayEmpiricalBlendWeight,
  rebalanceThreeWayProbabilities,
  type LambdaConfig,
  type TeamStatsInput,
} from "./match-stats";
import { computePoissonMarkets } from "./poisson";

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

// Moved 2026-08-19 from apps/backend/.../ev.constants.spec.ts — the config
// itself moved here (same category as OU_SHRINKAGE_CONFIG, calibrates the
// shared 1X2 probability rather than a staking decision).
describe("getLeagueThreeWayEmpiricalBlendWeight", () => {
  it("returns the I2 empirical rebalance weight", () => {
    expect(getLeagueThreeWayEmpiricalBlendWeight("I2").toNumber()).toBe(0.4);
  });

  it("returns 0 for F2 — removed 2026-08-19, did not survive walk-forward validation", () => {
    expect(getLeagueThreeWayEmpiricalBlendWeight("F2").toNumber()).toBe(0);
  });

  it("returns 0 for an unmapped league", () => {
    expect(getLeagueThreeWayEmpiricalBlendWeight("UNKNOWN").toNumber()).toBe(0);
  });
});

describe("rebalanceThreeWayProbabilities — joint markets stay coherent with the blended 1X2", () => {
  const homeStats: TeamStatsInput = {
    recentForm: 0.6,
    xgFor: 2.0,
    xgAgainst: 0.8,
    homeWinRate: 0.5,
    awayWinRate: 0.4,
    drawRate: 0.3,
    leagueVolatility: 0.5,
  };
  const awayStats: TeamStatsInput = {
    recentForm: 0.4,
    xgFor: 0.8,
    xgAgainst: 1.6,
    homeWinRate: 0.3,
    awayWinRate: 0.2,
    drawRate: 0.3,
    leagueVolatility: 0.5,
  };
  // Strong home favourite: the empirical blend pulls P(HOME) down a lot.
  const raw = computePoissonMarkets(2.37, 0.58);
  const rebalanced = rebalanceThreeWayProbabilities({
    probabilities: raw,
    homeStats,
    awayStats,
    blendWeight: new Decimal(0.45),
  });
  // 1e-4 rather than 1e-9: HT/FT and RESULT_BTTS are built from truncated
  // Poisson distributions (half-time halves, 10-goal cap) and already sum to
  // the RAW side masses only to ~1e-5; scaling preserves that gap, not more.
  const close = (a: Decimal, b: Decimal) =>
    expect(a.minus(b).abs().toNumber()).toBeLessThan(1e-4);

  it("moves the 1X2", () => {
    expect(rebalanced.home.lt(raw.home)).toBe(true);
  });

  it("keeps every RESULT_TOTAL_GOALS pick inside its side's mass", () => {
    for (const side of ["HOME", "DRAW", "AWAY"] as const) {
      const mass = rebalanced[side.toLowerCase() as "home" | "draw" | "away"];
      for (const line of ["1_5", "2_5", "3_5", "4_5"] as const) {
        const under = rebalanced.resultTotalGoals[`${side}_UNDER_${line}`]!;
        const over = rebalanced.resultTotalGoals[`${side}_OVER_${line}`]!;
        expect(under.lte(mass.plus(1e-9))).toBe(true);
        close(under.plus(over), mass);
      }
    }
    // The historical defect: HOME_UNDER_4_5 above P(HOME).
    expect(
      rebalanced.resultTotalGoals.HOME_UNDER_4_5!.lte(rebalanced.home),
    ).toBe(true);
  });

  it("makes RESULT_BTTS and HT/FT sum to the blended side masses", () => {
    for (const side of ["HOME", "DRAW", "AWAY"] as const) {
      const mass = rebalanced[side.toLowerCase() as "home" | "draw" | "away"];
      close(
        rebalanced.resultBtts[`${side}_YES`]!.plus(
          rebalanced.resultBtts[`${side}_NO`]!,
        ),
        mass,
      );
      const htftSide = (["HOME", "DRAW", "AWAY"] as const).reduce(
        (acc, ht) => acc.plus(rebalanced.htft[`${ht}_${side}`]),
        new Decimal(0),
      );
      close(htftSide, mass);
    }
  });

  it("scales win to nil with its side and keeps it below the side mass", () => {
    close(
      rebalanced.winToNilHome,
      raw.winToNilHome.times(rebalanced.home.div(raw.home)),
    );
    expect(rebalanced.winToNilHome.lte(rebalanced.home)).toBe(true);
  });

  it("leaves markets that span several outcomes untouched", () => {
    close(rebalanced.over25, raw.over25);
    close(rebalanced.bttsYes, raw.bttsYes);
    close(rebalanced.cleanSheetHome, raw.cleanSheetHome);
    close(rebalanced.winEitherHalfHome, raw.winEitherHalfHome);
    close(rebalanced.firstHalfWinner.home, raw.firstHalfWinner.home);
  });

  it("is the identity when the blend weight is zero", () => {
    const same = rebalanceThreeWayProbabilities({
      probabilities: raw,
      homeStats,
      awayStats,
      blendWeight: new Decimal(0),
    });
    close(same.htft.HOME_HOME, raw.htft.HOME_HOME);
    close(same.resultBtts.HOME_YES!, raw.resultBtts.HOME_YES!);
  });
});
