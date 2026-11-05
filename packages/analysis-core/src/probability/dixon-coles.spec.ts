import { describe, expect, it } from "vitest";
import { Market } from "../types";
import {
  buildPoissonDistributions,
  computeCorrectScoreMatrix,
  deriveMarketsFromPoisson,
  poissonProbaFromDistributions,
  scoreCells,
} from "./poisson";
import { boundedDixonColesRho, dixonColesTau } from "./dixon-coles";
import { fitMarketGridLambdas } from "../market-grid/market-grid";

const LH = 1.5;
const LA = 1.1;
const RHO = -0.1;

function cellsOf(rho: number, lh = LH, la = LA) {
  const { distHome, distAway } = buildPoissonDistributions(lh, la, 10);
  const cell = scoreCells({
    homeDist: distHome,
    awayDist: distAway,
    lambdaHome: lh,
    lambdaAway: la,
    rho,
  });
  return { distHome, distAway, cell };
}

describe("Dixon-Coles dependence", () => {
  it("is the independent product bit for bit at ρ = 0", () => {
    const { distHome, distAway, cell } = cellsOf(0);
    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        expect(cell(h, a)).toBe((distHome[h] ?? 0) * (distAway[a] ?? 0));
      }
    }
  });

  it("keeps both marginals and the total mass", () => {
    const { distHome, distAway, cell } = cellsOf(RHO);
    let total = 0;
    for (let h = 0; h <= 10; h++) {
      let row = 0;
      for (let a = 0; a <= 10; a++) row += cell(h, a);
      expect(row).toBeCloseTo(distHome[h] ?? 0, 12);
      total += row;
    }
    for (let a = 0; a <= 10; a++) {
      let col = 0;
      for (let h = 0; h <= 10; h++) col += cell(h, a);
      expect(col).toBeCloseTo(distAway[a] ?? 0, 12);
    }
    expect(total).toBeCloseTo(1, 12);
  });

  it("moves mass to 0-0 and 1-1 when ρ < 0", () => {
    const indep = computeCorrectScoreMatrix(LH, LA);
    const dc = computeCorrectScoreMatrix(LH, LA, { rho: RHO });
    expect(dc["0:0"]!.gt(indep["0:0"]!)).toBe(true);
    expect(dc["1:1"]!.gt(indep["1:1"]!)).toBe(true);
    expect(dc["1:0"]!.lt(indep["1:0"]!)).toBe(true);
    expect(dc["2:1"]!.eq(indep["2:1"]!)).toBe(true);
    expect(
      dixonColesTau(1, 1, { rho: RHO, lambdaHome: LH, lambdaAway: LA }),
    ).toBeCloseTo(1.1, 12);
  });

  it("bounds ρ so that no cell turns negative", () => {
    expect(
      boundedDixonColesRho({ rho: -2, lambdaHome: 2, lambdaAway: 4 }),
    ).toBe(-0.25);
    expect(boundedDixonColesRho({ rho: 1, lambdaHome: 2, lambdaAway: 2 })).toBe(
      0.25,
    );
  });

  it("derives BTTS, win to nil and the 1X2 from the dependent grid", () => {
    const { distHome, distAway, cell } = cellsOf(RHO);
    const oneXTwo = poissonProbaFromDistributions(distHome, distAway, cell);
    const markets = deriveMarketsFromPoisson({
      lambdaHome: LH,
      lambdaAway: LA,
      oneXTwo,
      rho: RHO,
    });
    let btts = 0;
    let winToNilHome = 0;
    let under25 = 0;
    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        if (h > 0 && a > 0) btts += cell(h, a);
        if (h > 0 && a === 0) winToNilHome += cell(h, a);
        if (h + a <= 2) under25 += cell(h, a);
      }
    }
    expect(markets.bttsYes.toNumber()).toBeCloseTo(btts, 12);
    expect(markets.winToNilHome.toNumber()).toBeCloseTo(winToNilHome, 12);
    expect(markets.under25.toNumber()).toBeCloseTo(under25, 12);
    // Team totals read the marginals: unchanged by ρ.
    const indep = deriveMarketsFromPoisson({
      lambdaHome: LH,
      lambdaAway: LA,
      oneXTwo,
    });
    expect(markets.teamTotalHome.OVER_1_5!.toNumber()).toBeCloseTo(
      indep.teamTotalHome.OVER_1_5!.toNumber(),
      12,
    );
    expect(markets.resultBtts.DRAW_YES!.gt(indep.resultBtts.DRAW_YES!)).toBe(
      true,
    );
  });

  it("re-fits λ under ρ so the grid reproduces the prices", () => {
    const { distHome, distAway, cell } = cellsOf(RHO);
    const oneXTwo = poissonProbaFromDistributions(distHome, distAway, cell);
    const markets = deriveMarketsFromPoisson({
      lambdaHome: LH,
      lambdaAway: LA,
      oneXTwo,
      rho: RHO,
    });
    const targets = {
      oneXTwo,
      lines: [
        { market: Market.OVER_UNDER, line: 2.5, fairOver: markets.over25 },
        { market: Market.OVER_UNDER, line: 1.5, fairOver: markets.over15 },
      ],
    };
    const fit = fitMarketGridLambdas(targets, RHO);
    expect(fit.rho).toBe(RHO);
    expect(fit.lambdaHome).toBeCloseTo(LH, 4);
    expect(fit.lambdaAway).toBeCloseTo(LA, 4);
    expect(fit.rmse).toBeLessThan(1e-6);
    // The independent fit cannot reproduce the same prices as closely.
    expect(fitMarketGridLambdas(targets).rmse).toBeGreaterThan(fit.rmse);
  });
});
