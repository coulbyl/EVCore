import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { Market } from "../types";
import type { RawOddsRow } from "../pricing/odds-assembly";
import {
  computePoissonMarkets,
  FIRST_HALF_GOAL_FRACTION,
} from "../probability/poisson";
import {
  computeMarketGrid,
  fitMarketGridLambdas,
  marketGridProbabilities,
  selectMarketGridQuotes,
  summarizeMarketGrid,
} from "./market-grid";
import {
  MARKET_GRID_FIRST_HALF_FRACTION,
  marketGridFirstHalfFraction,
} from "./market-grid.config";

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

  it("recovers λ from one start across lopsided and low-scoring grids", () => {
    for (const [lh, la] of [
      [3.6, 0.3],
      [0.3, 3.2],
      [0.6, 0.5],
      [2.4, 2.2],
    ] as const) {
      const p = computePoissonMarkets(lh, la);
      const fit = fitMarketGridLambdas({
        oneXTwo: { home: p.home, draw: p.draw, away: p.away },
        lines: [
          { market: Market.OVER_UNDER, line: 2.5, fairOver: p.over25 },
          { market: Market.OVER_UNDER, line: 3.5, fairOver: p.over35 },
        ],
      });
      expect(fit.lambdaHome).toBeCloseTo(lh, 4);
      expect(fit.lambdaAway).toBeCloseTo(la, 4);
    }
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

/** A book's half-time prices for first-half λ (independent Poisson). */
function halfTimeRows(input: {
  lambdaHome: number;
  lambdaAway: number;
  snapshotAt?: Date;
}): RawOddsRow[] {
  const snapshotAt = input.snapshotAt ?? BEFORE;
  const p = computePoissonMarkets(input.lambdaHome, input.lambdaAway);
  const row = (market: Market, pick: string, odds: number | undefined) => ({
    bookmaker: "Pinnacle",
    market,
    pick,
    odds: odds ?? null,
    snapshotAt,
    homeOdds: null,
    drawOdds: null,
    awayOdds: null,
  });
  const [home, draw, away] = shinOdds([
    p.home.toNumber(),
    p.draw.toNumber(),
    p.away.toNumber(),
  ]);
  const over05 = 1 - Math.exp(-(input.lambdaHome + input.lambdaAway));
  const [o05, u05] = shinOdds([over05, 1 - over05]);
  const [o15, u15] = shinOdds([p.over15.toNumber(), p.under15.toNumber()]);
  return [
    row(Market.FIRST_HALF_WINNER, "HOME", home),
    row(Market.FIRST_HALF_WINNER, "DRAW", draw),
    row(Market.FIRST_HALF_WINNER, "AWAY", away),
    row(Market.OVER_UNDER_HT, "OVER_0_5", o05),
    row(Market.OVER_UNDER_HT, "UNDER_0_5", u05),
    row(Market.OVER_UNDER_HT, "OVER_1_5", o15),
    row(Market.OVER_UNDER_HT, "UNDER_1_5", u15),
  ];
}

describe("computeMarketGrid, first half", () => {
  const full = () =>
    bookRows({ bookmaker: "Pinnacle", lambdaHome: 1.55, lambdaAway: 1.05 });

  it("splits λ by FIRST_HALF_GOAL_FRACTION without half-time prices", () => {
    const result = computeMarketGrid(full(), AT);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.firstHalf).toEqual({
      source: "fraction",
      fraction: FIRST_HALF_GOAL_FRACTION,
      reason: null,
    });
    const explicit = marketGridProbabilities(
      { ...result.fit, firstHalf: { fraction: FIRST_HALF_GOAL_FRACTION } },
      result.quotes.fairOneXTwo,
    );
    expect(result.probabilities.ouHT.OVER_1_5?.toString()).toBe(
      explicit.ouHT.OVER_1_5?.toString(),
    );
  });

  it("uses a league fraction when given one", () => {
    const at44 = computeMarketGrid(full(), AT);
    const at40 = computeMarketGrid(full(), AT, { firstHalfFraction: 0.4 });
    if (at44.status !== "ok" || at40.status !== "ok") throw new Error();
    expect(at40.probabilities.ouHT.OVER_0_5?.toNumber()).toBeLessThan(
      at44.probabilities.ouHT.OVER_0_5?.toNumber() ?? 0,
    );
    // Full-time markets do not move.
    expect(at40.probabilities.over25.toString()).toBe(
      at44.probabilities.over25.toString(),
    );
  });

  it("fits first-half λ on the book's half-time prices", () => {
    const result = computeMarketGrid(
      [...full(), ...halfTimeRows({ lambdaHome: 0.62, lambdaAway: 0.4 })],
      AT,
    );
    if (result.status !== "ok") throw new Error();
    expect(result.firstHalf.source).toBe("prices");
    if (result.firstHalf.source !== "prices") return;
    expect(result.firstHalf.lambdaHome).toBeCloseTo(0.62, 3);
    expect(result.firstHalf.lambdaAway).toBeCloseTo(0.4, 3);
    const truth = computePoissonMarkets(0.62, 0.4);
    expect(result.probabilities.firstHalfWinner.home.toNumber()).toBeCloseTo(
      truth.home.toNumber(),
      4,
    );
    expect(result.probabilities.ouHT.OVER_1_5?.toNumber()).toBeCloseTo(
      truth.over15.toNumber(),
      4,
    );
  });

  it("falls back to the fraction when half-time λ exceed full-time λ", () => {
    const result = computeMarketGrid(
      [...full(), ...halfTimeRows({ lambdaHome: 1.6, lambdaAway: 0.5 })],
      AT,
    );
    if (result.status !== "ok") throw new Error();
    expect(result.firstHalf).toMatchObject({
      source: "fraction",
      reason: "inconsistent",
    });
  });

  it("ignores half-time prices of another book", () => {
    const other = halfTimeRows({ lambdaHome: 0.62, lambdaAway: 0.4 }).map(
      (row) => ({ ...row, bookmaker: "Bet365" }),
    );
    const result = computeMarketGrid([...full(), ...other], AT);
    if (result.status !== "ok") throw new Error();
    expect(result.firstHalf).toMatchObject({
      source: "fraction",
      reason: "no_quotes",
    });
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

  it("ignores a line priced away from the 1X2's instant", () => {
    const rows = bookRows({
      bookmaker: "Pinnacle",
      lambdaHome: 1.5,
      lambdaAway: 1,
    }).map((row) =>
      row.pick === "OVER_3_5" || row.pick === "UNDER_3_5"
        ? { ...row, snapshotAt: new Date(BEFORE.getTime() - 61 * 60_000) }
        : row.pick === "UNDER_1_5"
          ? { ...row, snapshotAt: new Date(BEFORE.getTime() - 59 * 60_000) }
          : row,
    );
    const quotes = selectMarketGridQuotes(rows, AT);
    expect(quotes?.lines.map((l) => `${l.market}:${l.line}`)).toEqual([
      "OVER_UNDER:2.5",
      "TEAM_TOTAL_HOME:1.5",
    ]);
  });

  it("pairs an OVER with the UNDER of its own instant, not an older one", () => {
    const older = new Date(BEFORE.getTime() - 3 * 3_600_000);
    const rows = [
      ...bookRows({
        bookmaker: "Pinnacle",
        lambdaHome: 1.5,
        lambdaAway: 1,
        snapshotAt: older,
      }).filter((row) => row.pick !== "OVER"),
      ...bookRows({
        bookmaker: "Pinnacle",
        lambdaHome: 1.5,
        lambdaAway: 1,
      }).filter((row) => row.pick !== "UNDER"),
    ];
    const quotes = selectMarketGridQuotes(rows, AT);
    expect(quotes?.lines.map((l) => `${l.market}:${l.line}`)).toEqual([
      "OVER_UNDER:3.5",
      "TEAM_TOTAL_HOME:1.5",
    ]);
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

describe("marketGridFirstHalfFraction", () => {
  it("is 0.44 for every league while the fallback map is empty (05/11)", () => {
    expect(MARKET_GRID_FIRST_HALF_FRACTION).toEqual({});
    expect(marketGridFirstHalfFraction("UECL")).toBe(FIRST_HALF_GOAL_FRACTION);
    expect(marketGridFirstHalfFraction("NOPE")).toBe(FIRST_HALF_GOAL_FRACTION);
    expect(marketGridFirstHalfFraction(null)).toBe(FIRST_HALF_GOAL_FRACTION);
  });
});
