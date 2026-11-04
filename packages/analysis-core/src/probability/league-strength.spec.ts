import { describe, expect, it } from "vitest";
import {
  crossLeagueLambdaFactors,
  fitLeagueStrengths,
  LEAGUE_STRENGTH_MAX_FACTOR,
  type LeagueStrengthObservation,
} from "./league-strength";
import { deriveLambdas } from "./match-stats";

const obs = (
  homeLeague: string | null,
  awayLeague: string | null,
  goals: [number, number],
): LeagueStrengthObservation => ({
  homeLeague,
  awayLeague,
  lambdaHome: 1.5,
  lambdaAway: 1.5,
  homeGoals: goals[0],
  awayGoals: goals[1],
});

describe("fitLeagueStrengths", () => {
  it("is 0 everywhere on an empty sample", () => {
    expect(fitLeagueStrengths([], { priorSd: 0.2, minMatches: 1 })).toEqual({});
  });

  it("ignores same-league fixtures", () => {
    const fit = fitLeagueStrengths(
      Array.from({ length: 20 }, () => obs("PL", "PL", [5, 0])),
      { priorSd: 0.2, minMatches: 1 },
    );
    expect(fit).toEqual({});
  });

  it("solves the one-league case exactly (ridge-penalised Poisson)", () => {
    // PL home vs an unknown league, 10 times, 3–0 each time against λ0 1.5 /
    // 1.5. Stationarity: 10·(3 − 1.5e^r) − 10·(0 − 1.5e^−r) = r / σ².
    const fit = fitLeagueStrengths(
      Array.from({ length: 10 }, () => obs("PL", null, [3, 0])),
      { priorSd: 0.2, minMatches: 1, iterations: 200 },
    );
    const r = fit.PL!;
    const residual =
      10 * (3 - 1.5 * Math.exp(r)) - 10 * (0 - 1.5 * Math.exp(-r)) - r / 0.04;
    expect(Math.abs(residual)).toBeLessThan(1e-9);
    expect(r).toBeCloseTo(0.5316, 3);
  });

  it("is antisymmetric between two leagues meeting home and away", () => {
    const sample = [
      ...Array.from({ length: 10 }, () => obs("L1", "GRE1", [2, 1])),
      ...Array.from({ length: 10 }, () => obs("GRE1", "L1", [1, 2])),
    ];
    const fit = fitLeagueStrengths(sample, { priorSd: 0.2, minMatches: 1 });
    expect(fit.L1!).toBeGreaterThan(0);
    expect(fit.L1! + fit.GRE1!).toBeCloseTo(0, 9);
  });

  it("keeps a league below minMatches at 0", () => {
    const fit = fitLeagueStrengths(
      Array.from({ length: 4 }, () => obs("PL", "EST1", [4, 0])),
      { priorSd: 0.2, minMatches: 5 },
    );
    expect(fit).toEqual({});
  });

  it("shrinks harder with a tighter prior", () => {
    const sample = Array.from({ length: 10 }, () => obs("PL", null, [3, 0]));
    const loose = fitLeagueStrengths(sample, { priorSd: 0.5, minMatches: 1 });
    const tight = fitLeagueStrengths(sample, { priorSd: 0.05, minMatches: 1 });
    expect(tight.PL!).toBeLessThan(loose.PL!);
    expect(tight.PL!).toBeGreaterThan(0);
  });
});

describe("crossLeagueLambdaFactors", () => {
  it("is neutral for two teams of the same league", () => {
    expect(
      crossLeagueLambdaFactors({
        homeLeague: "L1",
        awayLeague: "L1",
        strengths: { L1: 0.3 },
      }),
    ).toEqual({ home: 1, away: 1 });
  });

  it("is neutral for leagues without a strength", () => {
    expect(
      crossLeagueLambdaFactors({
        homeLeague: "XX",
        awayLeague: null,
        strengths: {},
      }),
    ).toEqual({ home: 1, away: 1 });
  });

  it("multiplies the home λ by exp(r_H − r_A) and the away λ by its inverse", () => {
    const factors = crossLeagueLambdaFactors({
      homeLeague: "L1",
      awayLeague: "GRE1",
      strengths: { L1: 0.15, GRE1: -0.05 },
    });
    expect(factors.home).toBeCloseTo(Math.exp(0.2), 12);
    expect(factors.away).toBeCloseTo(Math.exp(-0.2), 12);
  });

  it("is bounded by LEAGUE_STRENGTH_MAX_FACTOR", () => {
    const factors = crossLeagueLambdaFactors({
      homeLeague: "A",
      awayLeague: "B",
      strengths: { A: 2, B: -2 },
    });
    expect(factors.home).toBeCloseTo(LEAGUE_STRENGTH_MAX_FACTOR, 12);
    expect(factors.away).toBeCloseTo(1 / LEAGUE_STRENGTH_MAX_FACTOR, 12);
  });
});

describe("deriveLambdas with crossLeagueFactors", () => {
  // Rennes – Olympiakos, UEL 2026-11-04 (model_run 2026-11-02 17:05):
  // blended xgFor / xgAgainst 1.954 / 1.927 and 1.616 / 0.710 → 1.150 / 1.551.
  const home = { xgFor: 1.954, xgAgainst: 1.927 } as never;
  const away = { xgFor: 1.616, xgAgainst: 0.71 } as never;
  const config = {
    meanLambda: 1.4,
    homeAdvFactor: 1.1,
    awayDisadvFactor: 0.85,
  };

  it("reproduces the stored λ of Rennes – Olympiakos without a factor", () => {
    const lambda = deriveLambdas(home, away, config);
    expect(lambda.home).toBeCloseTo(1.15, 2);
    expect(lambda.away).toBeCloseTo(1.551, 2);
  });

  it("scales each λ by its factor", () => {
    const base = deriveLambdas(home, away, config);
    const scaled = deriveLambdas(home, away, {
      ...config,
      crossLeagueFactors: { home: 1.2, away: 0.8 },
    });
    expect(scaled.home).toBeCloseTo(base.home * 1.2, 12);
    expect(scaled.away).toBeCloseTo(base.away * 0.8, 12);
  });
});
