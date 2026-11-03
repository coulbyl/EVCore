import { describe, expect, it } from "vitest";
import { BetStatus } from "@evcore/analysis-core";
import {
  buildNewMarketsReport,
  fairProbabilities,
  quoteKey,
  renderNewMarketsReport,
  wilsonInterval,
  type ClosingQuote,
} from "./new-markets-report";

const quote = (overrides: Partial<ClosingQuote>): ClosingQuote => ({
  fixtureId: "f1",
  bookmaker: "1xBet",
  market: "CORNERS_HOME",
  pick: "OVER",
  line: 4.5,
  odds: "1.80",
  ...overrides,
});

describe("fairProbabilities", () => {
  it("normalises a complete closed group", () => {
    const over = quote({ odds: "1.80" });
    const under = quote({ pick: "UNDER", odds: "2.00" });
    const fair = fairProbabilities([over, under]);
    // 1/1.8 = 0.5556, 1/2 = 0.5, total 1.0556.
    expect(fair.get(quoteKey(over))?.toFixed(4)).toBe("0.5263");
    expect(fair.get(quoteKey(under))?.toFixed(4)).toBe("0.4737");
  });

  it("leaves out an incomplete group and an open market", () => {
    const fair = fairProbabilities([
      quote({}),
      quote({
        market: "GOAL_SCORER_ANYTIME",
        pick: "P11",
        line: null,
        odds: "3.00",
      }),
      quote({ market: "MINUTE_1X2", pick: "DRAW", line: 15, odds: "1.33" }),
    ]);
    expect(fair.size).toBe(0);
  });

  it("keeps the lines of one market apart", () => {
    const fair = fairProbabilities([
      quote({ line: 4.5 }),
      quote({ line: 4.5, pick: "UNDER" }),
      quote({ line: 5.5 }),
    ]);
    expect(fair.size).toBe(2);
  });
});

describe("wilsonInterval", () => {
  it("brackets the observed rate, nothing without a trial", () => {
    const ci = wilsonInterval(40, 100);
    expect(ci?.low).toBeCloseTo(0.3094, 3);
    expect(ci?.high).toBeCloseTo(0.498, 3);
    expect(wilsonInterval(0, 0)).toBeNull();
  });
});

describe("buildNewMarketsReport", () => {
  it("computes every figure on the settled quotes only, refunds and unknowns apart", () => {
    const quotes = [
      quote({ fixtureId: "f1" }),
      quote({ fixtureId: "f1", pick: "UNDER", odds: "2.00" }),
      quote({ fixtureId: "f2" }),
      quote({ fixtureId: "f3" }),
      quote({ fixtureId: "f4", odds: "1.90" }),
    ];
    const outcomes: Record<string, BetStatus | null> = {
      "f1|OVER": BetStatus.WON,
      "f1|UNDER": BetStatus.LOST,
      "f2|OVER": BetStatus.VOID,
      "f3|OVER": null,
      "f4|OVER": BetStatus.LOST,
    };
    const rows = buildNewMarketsReport({
      quotes,
      outcomeOf: (q) => outcomes[`${q.fixtureId}|${q.pick}`] ?? null,
    });
    expect(rows).toHaveLength(2);
    const [low, high] = rows;
    expect(low).toMatchObject({
      band: "1,50–2,00",
      quotes: 4,
      settled: 2,
      voids: 1,
      unknown: 1,
      won: 1,
      realised: 0.5,
      fairSettled: 1,
    });
    // 1/1.8 and 1/1.9.
    expect(low?.implied).toBeCloseTo((1 / 1.8 + 1 / 1.9) / 2, 6);
    expect(low?.fair).toBeCloseTo(0.5263, 4);
    expect(high).toMatchObject({ band: "2,00–3,00", settled: 1, won: 0 });
  });

  it("renders an empty window without failing", () => {
    const text = renderNewMarketsReport({
      rows: [],
      from: new Date("2026-10-07T00:00:00Z"),
      to: new Date("2026-11-04T00:00:00Z"),
      maxHoursBeforeKickoff: 3,
    });
    expect(text).toContain("Aucune cote de clôture réglable");
  });
});
