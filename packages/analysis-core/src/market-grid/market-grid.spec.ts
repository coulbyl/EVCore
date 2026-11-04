import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { Market } from "../types";
import type { RawOddsRow } from "../pricing/odds-assembly";
import { computePoissonMarkets } from "../probability/poisson";
import {
  computeMarketGrid,
  fitMarketGridLambdas,
  selectMarketGridQuotes,
  summarizeMarketGrid,
} from "./market-grid";

const AT = new Date("2026-10-20T18:00:00.000Z");
const BEFORE = new Date("2026-10-20T15:00:00.000Z");
const AFTER = new Date("2026-10-20T18:30:00.000Z");

/**
 * Odds a book with Shin margin z would post for these fair probabilities —
 * the exact inverse of shinProbabilities: π_i = √B · √((1 − z) p_i² + z p_i),
 * with √B = Σ √((1 − z) p_i² + z p_i).
 */
function shinOdds(fair: readonly number[], z = 0.02): number[] {
  const roots = fair.map((p) => Math.sqrt((1 - z) * p * p + z * p));
  const sqrtB = roots.reduce((a, b) => a + b, 0);
  return roots.map((root) => 1 / (sqrtB * root));
}

function bookRows(input: {
  bookmaker: string;
  lambdaHome: number;
  lambdaAway: number;
  snapshotAt?: Date;
  withOverUnder?: boolean;
}): RawOddsRow[] {
  const { bookmaker, lambdaHome, lambdaAway } = input;
  const snapshotAt = input.snapshotAt ?? BEFORE;
  const p = computePoissonMarkets(lambdaHome, lambdaAway);
  const [home, draw, away] = shinOdds([
    p.home.toNumber(),
    p.draw.toNumber(),
    p.away.toNumber(),
  ]);
  const rows: RawOddsRow[] = [
    {
      bookmaker,
      market: Market.ONE_X_TWO,
      pick: null,
      odds: null,
      snapshotAt,
      homeOdds: home ?? null,
      drawOdds: draw ?? null,
      awayOdds: away ?? null,
    },
  ];
  const twoWay = (
    market: Market,
    over: string,
    under: string,
    pOver: number,
  ) => {
    const [o, u] = shinOdds([pOver, 1 - pOver]);
    for (const [pick, odds] of [
      [over, o],
      [under, u],
    ] as const) {
      rows.push({
        bookmaker,
        market,
        pick,
        odds: odds ?? null,
        snapshotAt,
        homeOdds: null,
        drawOdds: null,
        awayOdds: null,
      });
    }
  };
  if (input.withOverUnder !== false) {
    twoWay(Market.OVER_UNDER, "OVER", "UNDER", p.over25.toNumber());
    twoWay(Market.OVER_UNDER, "OVER_3_5", "UNDER_3_5", p.over35.toNumber());
  }
  twoWay(
    Market.TEAM_TOTAL_HOME,
    "OVER_1_5",
    "UNDER_1_5",
    (p.teamTotalHome.OVER_1_5 as Decimal).toNumber(),
  );
  return rows;
}

describe("fitMarketGridLambdas", () => {
  it("recovers λ from the fair probabilities of a known grid", () => {
    const p = computePoissonMarkets(1.7, 0.9);
    const fit = fitMarketGridLambdas({
      oneXTwo: { home: p.home, draw: p.draw, away: p.away },
      lines: [
        { market: Market.OVER_UNDER, line: 2.5, fairOver: p.over25 },
        { market: Market.OVER_UNDER, line: 1.5, fairOver: p.over15 },
        {
          market: Market.TEAM_TOTAL_AWAY,
          line: 0.5,
          fairOver: p.teamTotalAway.OVER_0_5 as Decimal,
        },
      ],
    });
    expect(fit.lambdaHome).toBeCloseTo(1.7, 4);
    expect(fit.lambdaAway).toBeCloseTo(0.9, 4);
    expect(fit.rmse).toBeLessThan(1e-6);
  });

  it("is deterministic", () => {
    const p = computePoissonMarkets(1.2, 1.4);
    const targets = {
      oneXTwo: { home: p.home, draw: p.draw, away: p.away },
      lines: [{ market: Market.OVER_UNDER, line: 2.5, fairOver: p.over25 }],
    };
    expect(fitMarketGridLambdas(targets)).toEqual(
      fitMarketGridLambdas(targets),
    );
  });
});

describe("computeMarketGrid", () => {
  it("reproduces the prices it was fitted on, margin removed", () => {
    const result = computeMarketGrid(
      bookRows({ bookmaker: "Pinnacle", lambdaHome: 1.55, lambdaAway: 1.05 }),
      AT,
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const truth = computePoissonMarkets(1.55, 1.05);
    expect(result.quotes.bookmaker).toBe("Pinnacle");
    expect(result.fit.lambdaHome).toBeCloseTo(1.55, 3);
    expect(result.fit.lambdaAway).toBeCloseTo(1.05, 3);
    for (const [got, want] of [
      [result.probabilities.home, truth.home],
      [result.probabilities.draw, truth.draw],
      [result.probabilities.away, truth.away],
      [result.probabilities.over25, truth.over25],
      [result.probabilities.over35, truth.over35],
      [result.probabilities.bttsYes, truth.bttsYes],
      [result.probabilities.dc1X, truth.dc1X],
    ] as const) {
      expect(got.toNumber()).toBeCloseTo(want.toNumber(), 4);
    }
    // Same shape as the statistics engine: every market the channels read.
    expect(Object.keys(result.probabilities).sort()).toEqual(
      Object.keys(truth).sort(),
    );
  });

  it("keeps the book's fair 1X2 when the grid cannot reproduce the draw", () => {
    // Pinnacle draw at 0.30 for a 2.2-goal match: above an independent
    // Poisson pair's draw; the 1X2 handed to the channels is still the book's.
    const [home, draw, away] = shinOdds([0.42, 0.3, 0.28]);
    const [over, under] = shinOdds([0.45, 0.55]);
    const rows: RawOddsRow[] = [
      {
        bookmaker: "Pinnacle",
        market: Market.ONE_X_TWO,
        pick: null,
        odds: null,
        snapshotAt: BEFORE,
        homeOdds: home ?? null,
        drawOdds: draw ?? null,
        awayOdds: away ?? null,
      },
      ...[
        ["OVER", over],
        ["UNDER", under],
      ].map(([pick, odds]) => ({
        bookmaker: "Pinnacle",
        market: Market.OVER_UNDER,
        pick: pick as string,
        odds: (odds as number) ?? null,
        snapshotAt: BEFORE,
        homeOdds: null,
        drawOdds: null,
        awayOdds: null,
      })),
    ];
    const result = computeMarketGrid(rows, AT);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.probabilities.draw.toNumber()).toBeCloseTo(0.3, 6);
    expect(result.probabilities.home.toNumber()).toBeCloseTo(0.42, 6);
  });

  it("refuses prices that contradict each other", () => {
    // A 50 % draw with 90 % over 2.5: no Poisson pair is near both.
    const [home, draw, away] = shinOdds([0.25, 0.5, 0.25]);
    const [over, under] = shinOdds([0.9, 0.1]);
    const rows: RawOddsRow[] = [
      {
        bookmaker: "Pinnacle",
        market: Market.ONE_X_TWO,
        pick: null,
        odds: null,
        snapshotAt: BEFORE,
        homeOdds: home ?? null,
        drawOdds: draw ?? null,
        awayOdds: away ?? null,
      },
      ...[
        ["OVER", over],
        ["UNDER", under],
      ].map(([pick, odds]) => ({
        bookmaker: "Pinnacle",
        market: Market.OVER_UNDER,
        pick: pick as string,
        odds: (odds as number) ?? null,
        snapshotAt: BEFORE,
        homeOdds: null,
        drawOdds: null,
        awayOdds: null,
      })),
    ];
    const result = computeMarketGrid(rows, AT);
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable")
      expect(result.reason).toBe("fit_error");
  });
});

describe("selectMarketGridQuotes", () => {
  it("prefers Pinnacle over Bet365", () => {
    const rows = [
      ...bookRows({ bookmaker: "Bet365", lambdaHome: 1.2, lambdaAway: 1.2 }),
      ...bookRows({ bookmaker: "Pinnacle", lambdaHome: 1.5, lambdaAway: 1 }),
    ];
    expect(selectMarketGridQuotes(rows, AT)?.bookmaker).toBe("Pinnacle");
  });

  it("falls back to Bet365 when Pinnacle has no total-goals line", () => {
    const rows = [
      ...bookRows({ bookmaker: "Bet365", lambdaHome: 1.2, lambdaAway: 1.2 }),
      ...bookRows({
        bookmaker: "Pinnacle",
        lambdaHome: 1.5,
        lambdaAway: 1,
        withOverUnder: false,
      }),
    ];
    expect(selectMarketGridQuotes(rows, AT)?.bookmaker).toBe("Bet365");
  });

  it("ignores soft books and rows priced after the cutoff", () => {
    const rows = [
      ...bookRows({ bookmaker: "1xBet", lambdaHome: 1.2, lambdaAway: 1.2 }),
      ...bookRows({
        bookmaker: "Pinnacle",
        lambdaHome: 1.5,
        lambdaAway: 1,
        snapshotAt: AFTER,
      }),
    ];
    expect(selectMarketGridQuotes(rows, AT)).toBeNull();
    expect(computeMarketGrid(rows, AT)).toMatchObject({
      status: "unavailable",
      reason: "no_sharp_quotes",
    });
  });

  it("reads every complete line, and only complete ones", () => {
    const rows = bookRows({
      bookmaker: "Pinnacle",
      lambdaHome: 1.5,
      lambdaAway: 1,
    }).filter((row) => row.pick !== "UNDER_3_5");
    const quotes = selectMarketGridQuotes(rows, AT);
    expect(quotes?.lines.map((l) => `${l.market}:${l.line}`)).toEqual([
      "OVER_UNDER:2.5",
      "TEAM_TOTAL_HOME:1.5",
    ]);
  });
});

describe("summarizeMarketGrid", () => {
  it("traces the book, the prices read and the fitted λ", () => {
    const summary = summarizeMarketGrid(
      computeMarketGrid(
        bookRows({ bookmaker: "Bet365", lambdaHome: 1.3, lambdaAway: 1.2 }),
        AT,
      ),
    );
    expect(summary).toMatchObject({
      status: "ok",
      reason: null,
      bookmaker: "Bet365",
      snapshotAt: BEFORE.toISOString(),
    });
    expect(summary.prices?.lines).toHaveLength(3);
    expect(summary.lambdaHome).toBeCloseTo(1.3, 3);
  });

  it("says why the grid was not used", () => {
    expect(summarizeMarketGrid(computeMarketGrid([], AT))).toMatchObject({
      status: "unavailable",
      reason: "no_sharp_quotes",
      prices: null,
      lambdaHome: null,
    });
  });
});
