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

  it("calibrates HT Over 1.5 to the empirical base rate, not the naive λ/2 split", () => {
    // Full-time goal expectancy ≈ 2.79 (our dataset average). The naive half-
    // symmetric model uses λ_1H = 2.79/2 = 1.396 → P(HT total ≥ 2) ≈ 0.407, which
    // over-predicts the observed 0.353. With FIRST_HALF_GOAL_FRACTION = 0.44 the
    // model must land near the empirical base rate.
    const m = computePoissonMarkets(1.55, 1.24); // λ_total ≈ 2.79
    const htOver15 = m.ouHT.OVER_1_5!.toNumber();
    // Lands in a tight band around the empirical 0.353 (model gives ≈ 0.347)…
    expect(htOver15).toBeGreaterThan(0.33);
    expect(htOver15).toBeLessThan(0.37);
    // …and well below the naive λ/2 value (≈ 0.407) that caused the losing HT picks.
    expect(htOver15).toBeLessThan(0.4);
  });

  it("Draw No Bet home+away sums to 1 and matches the non-draw-renormalized formula", () => {
    const m = computePoissonMarkets(1.7, 1.2);
    expect(m.dnbHome.plus(m.dnbAway).toNumber()).toBeCloseTo(1, 10);

    const oneXTwo = poissonProba(1.7, 1.2);
    const expectedDnbHome = oneXTwo.home.div(oneXTwo.home.plus(oneXTwo.away));
    expect(m.dnbHome.toNumber()).toBeCloseTo(expectedDnbHome.toNumber(), 10);
  });

  it("Draw No Bet renormalizes above the raw 1X2 probability for the same side", () => {
    // Dividing by the non-draw mass (< 1, since a draw carries positive
    // probability) always pushes dnbHome/dnbAway above the raw 1X2 value for
    // that side — this is what makes DNB distinct from a raw two-way split.
    const oneXTwo = poissonProba(1.7, 1.2);
    const m = computePoissonMarkets(1.7, 1.2);
    expect(m.dnbHome.toNumber()).toBeGreaterThan(oneXTwo.home.toNumber());
    expect(m.dnbAway.toNumber()).toBeGreaterThan(oneXTwo.away.toNumber());
  });

  it("Team Total marginals: Over/Under for the same line sum to 1, independent per side", () => {
    const m = computePoissonMarkets(1.7, 1.2);
    expect(
      m.teamTotalHome.OVER_1_5!.plus(m.teamTotalHome.UNDER_1_5!).toNumber(),
    ).toBeCloseTo(1, 10);
    expect(
      m.teamTotalAway.OVER_0_5!.plus(m.teamTotalAway.UNDER_0_5!).toNumber(),
    ).toBeCloseTo(1, 10);
  });

  it("Team Total home side has higher Over probability than away when lambda is higher", () => {
    const m = computePoissonMarkets(2.2, 0.9);
    expect(m.teamTotalHome.OVER_1_5!.toNumber()).toBeGreaterThan(
      m.teamTotalAway.OVER_1_5!.toNumber(),
    );
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
