import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  countConditionalOver,
  countLineProbabilities,
  fitCountMean,
  selectCountLadder,
  type CountQuote,
} from "./count-market";

describe("countLineProbabilities", () => {
  it("matches Poisson on a half line", () => {
    // P(Y ≤ 0 | μ = 1) = e^-1
    const p = countLineProbabilities({ mean: 1, size: null, line: 0.5 });
    expect(p.under.toNumber()).toBeCloseTo(Math.exp(-1), 10);
    expect(p.push.toNumber()).toBe(0);
    expect(p.over.plus(p.under).toNumber()).toBeCloseTo(1, 10);
  });

  it("pushes on a whole line", () => {
    const p = countLineProbabilities({ mean: 2, size: null, line: 1 });
    expect(p.push.toNumber()).toBeCloseTo(2 * Math.exp(-2), 10);
    expect(p.over.plus(p.under).plus(p.push).toNumber()).toBeCloseTo(1, 10);
  });

  it("spreads more with a negative binomial of the same mean", () => {
    const poisson = countLineProbabilities({
      mean: 10,
      size: null,
      line: 13.5,
    });
    const nb = countLineProbabilities({ mean: 10, size: 10, line: 13.5 });
    expect(nb.over.toNumber()).toBeGreaterThan(poisson.over.toNumber());
  });
});

describe("fitCountMean", () => {
  it("recovers the mean of a ladder it generated", () => {
    const lines = [8.5, 9.5, 10.5].map((line) => ({
      line,
      fairOver: countConditionalOver({ mean: 9.8, size: 20, line }),
    }));
    const fit = fitCountMean({ lines, size: 20, maxRmse: 0.02 });
    expect(fit?.mean).toBeCloseTo(9.8, 4);
  });

  it("refuses a ladder the distribution cannot carry", () => {
    const lines = [
      { line: 8.5, fairOver: new Decimal(0.3) },
      { line: 10.5, fairOver: new Decimal(0.7) },
    ];
    expect(fitCountMean({ lines, size: null, maxRmse: 0.02 })).toBeNull();
  });

  it("returns null without lines", () => {
    expect(fitCountMean({ lines: [], size: null, maxRmse: 0.02 })).toBeNull();
  });
});

describe("selectCountLadder", () => {
  const at = (min: number) => new Date(Date.UTC(2026, 10, 5, 12, min));
  const q = (
    line: number,
    pick: "OVER" | "UNDER",
    odds: number,
    min: number,
  ): CountQuote => ({
    line,
    pick,
    odds,
    snapshotAt: at(min),
  });

  it("keeps the latest complete pair per line, margin removed", () => {
    const ladder = selectCountLadder(
      [
        q(9.5, "OVER", 2.0, 0),
        q(9.5, "UNDER", 1.8, 0),
        q(9.5, "OVER", 1.9, 30),
        q(9.5, "UNDER", 1.9, 30),
      ],
      60,
    );
    expect(ladder).toHaveLength(1);
    expect(ladder[0]?.fairOver.toNumber()).toBeCloseTo(0.5, 10);
  });

  it("drops a line quoted too long before the latest pair and an incomplete pair", () => {
    const ladder = selectCountLadder(
      [
        q(9.5, "OVER", 1.9, 120),
        q(9.5, "UNDER", 1.9, 120),
        q(8.5, "OVER", 1.6, 0),
        q(8.5, "UNDER", 2.3, 0),
        q(10.5, "OVER", 2.4, 120),
      ],
      60,
    );
    expect(ladder.map((l) => l.line)).toEqual([9.5]);
  });
});
