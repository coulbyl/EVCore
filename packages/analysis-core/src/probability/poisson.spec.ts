import { describe, expect, it } from "vitest";
import {
  buildPoissonDistributions,
  computeCorrectScoreMatrix,
  computePoissonMarkets,
  poissonProba,
} from "./poisson";

describe("poissonProba", () => {
  it("returns a 1X2 distribution that sums to 1", () => {
    const { home, draw, away } = poissonProba(1.6, 1.1);
    expect(home.plus(draw).plus(away).toNumber()).toBeCloseTo(1, 10);
  });

  it("favours the home side when its lambda is higher", () => {
    const { home, away } = poissonProba(2.0, 0.8);
    expect(home.greaterThan(away)).toBe(true);
  });

  it("is symmetric for equal lambdas (home ≈ away, draw shared)", () => {
    const { home, away } = poissonProba(1.3, 1.3);
    expect(home.toNumber()).toBeCloseTo(away.toNumber(), 10);
  });
});

describe("computePoissonMarkets", () => {
  it("keeps each derived two-way market coherent (over + under = 1)", () => {
    const m = computePoissonMarkets(1.7, 1.2);
    expect(m.over25.plus(m.under25).toNumber()).toBeCloseTo(1, 10);
    expect(m.bttsYes.plus(m.bttsNo).toNumber()).toBeCloseTo(1, 10);
    expect(m.over15.plus(m.under15).toNumber()).toBeCloseTo(1, 10);
  });

  it("produces 9 HT/FT outcomes summing to ≈ 1", () => {
    const { htft } = computePoissonMarkets(1.5, 1.0);
    const keys = Object.keys(htft);
    expect(keys).toHaveLength(9);
    const total = keys.reduce(
      (acc, k) => acc + htft[k as keyof typeof htft].toNumber(),
      0,
    );
    expect(total).toBeCloseTo(1, 6);
  });
});

describe("computeCorrectScoreMatrix", () => {
  it("returns a (maxGoals+1)^2 grid whose cells sum to ≈ 1", () => {
    const matrix = computeCorrectScoreMatrix(1.6, 1.1, 6);
    expect(Object.keys(matrix)).toHaveLength(49);
    const total = Object.values(matrix).reduce(
      (acc, p) => acc + p.toNumber(),
      0,
    );
    expect(total).toBeCloseTo(1, 10);
  });

  it("each cell equals the product of the marginal goal probabilities", () => {
    const { distHome, distAway } = buildPoissonDistributions(1.6, 1.1, 6);
    const matrix = computeCorrectScoreMatrix(1.6, 1.1, 6);
    expect(matrix["1:0"]!.toNumber()).toBeCloseTo(
      (distHome[1] ?? 0) * (distAway[0] ?? 0),
      10,
    );
  });

  it("is coherent with the 1X2 vector (summing cells by outcome)", () => {
    const lh = 1.7;
    const la = 1.2;
    const matrix = computeCorrectScoreMatrix(lh, la, 6);
    let home = 0;
    for (const [score, p] of Object.entries(matrix)) {
      const [h, a] = score.split(":").map(Number);
      if ((h ?? 0) > (a ?? 0)) home += p.toNumber();
    }
    // Same maxGoals so both truncate identically → home shares match closely.
    expect(home).toBeCloseTo(poissonProba(lh, la, 6).home.toNumber(), 6);
  });
});

describe("buildPoissonDistributions", () => {
  it("returns home/away goal distributions that each normalize to 1", () => {
    const { distHome, distAway } = buildPoissonDistributions(1.4, 1.1);
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(distHome)).toBeCloseTo(1, 10);
    expect(sum(distAway)).toBeCloseTo(1, 10);
  });
});
