import Decimal from "decimal.js";
import { Market } from "../types";
import type { FullOddsSnapshot } from "../selection/types";
import {
  isHalfTimeFullTimePick,
  type HalfTimeFullTimePick,
} from "../probability/markets";

// Pure assembly of a fixture's FullOddsSnapshot from a flat list of raw odds
// rows (any market/bookmaker/time), as of a given point-in-time cutoff.
// Extracted 2026-08-17 from apps/backend's OddsSnapshotLoader so the exact
// same odds-resolution logic (best bookmaker per market, per-pick resolution
// for sparse markets, cutoff enforcement) backs both the live betting engine
// and the backtest harness — one implementation, not two that can drift.
//
// No DB, no HTTP, no framework: callers fetch rows however they like (a
// single Prisma query for prod, a chronological point-in-time loader for
// backtests) and pass them in as plain objects.

// Decimal-like odds value: `Prisma.Decimal`, `decimal.js` `Decimal`, or a
// plain number/string all satisfy this — deliberately NOT `Prisma.Decimal`
// itself, which would pull `@prisma/client` into this package and violate
// its hard "no infrastructure" boundary (see architecture.guard.spec.ts).
type DecimalLike = { toString(): string };

export type RawOddsRow = {
  bookmaker: string;
  market: Market;
  pick: string | null;
  odds: DecimalLike | null;
  snapshotAt: Date;
  homeOdds: DecimalLike | null;
  drawOdds: DecimalLike | null;
  awayOdds: DecimalLike | null;
};

// Bookmaker preference order when several offer the same market at the same
// snapshot timestamp. Lower rank wins (sharpest book first).
export function bookmakerRank(bookmaker: string): number {
  if (bookmaker === "Pinnacle") return 0;
  if (bookmaker === "Bet365") return 1;
  if (bookmaker === "Unibet") return 2;
  if (bookmaker === "Marathonbet") return 3;
  if (bookmaker === "Bwin") return 4;
  if (bookmaker === "MarketAvg") return 5;
  return 6;
}

// The 8 sparse OVER_UNDER lines (bare 2.5 + 1.5/3.5/4.5), each an independent
// binary market — unlike ONE_X_TWO's correlated home/draw/away triplet, a
// bookmaker covering one line says nothing about whether it covers another.
export const OVER_UNDER_PICKS = [
  "OVER_1_5",
  "UNDER_1_5",
  "OVER",
  "UNDER",
  "OVER_3_5",
  "UNDER_3_5",
  "OVER_4_5",
  "UNDER_4_5",
] as const;

export const OU_HT_PICKS = [
  "OVER_0_5",
  "UNDER_0_5",
  "OVER_1_5",
  "UNDER_1_5",
] as const;

export const TEAM_TOTAL_PICKS = [
  "OVER_0_5",
  "UNDER_0_5",
  "OVER_1_5",
  "UNDER_1_5",
  "OVER_2_5",
  "UNDER_2_5",
  "OVER_3_5",
  "UNDER_3_5",
  "OVER_4_5",
  "UNDER_4_5",
  "OVER_5_5",
  "UNDER_5_5",
  "OVER_6_5",
  "UNDER_6_5",
] as const;

export const RESULT_TOTAL_GOALS_PICKS = (
  ["HOME", "DRAW", "AWAY"] as const
).flatMap((side) =>
  (["1_5", "2_5", "3_5", "4_5"] as const).flatMap((line) => [
    `${side}_OVER_${line}` as const,
    `${side}_UNDER_${line}` as const,
  ]),
);

export const RESULT_BTTS_PICKS = (["HOME", "DRAW", "AWAY"] as const).flatMap(
  (side) => [`${side}_YES` as const, `${side}_NO` as const],
);

export function parseYesNoRows(
  rows: { pick: string | null; odds: DecimalLike | null }[] | null,
): { yes: Decimal; no: Decimal } | null {
  if (rows === null) return null;
  const yesRow = rows.find((r) => r.pick === "YES");
  const noRow = rows.find((r) => r.pick === "NO");
  if (!yesRow?.odds || !noRow?.odds) return null;
  return {
    yes: new Decimal(yesRow.odds.toString()),
    no: new Decimal(noRow.odds.toString()),
  };
}

export function parseHomeAwayRows(
  rows: { pick: string | null; odds: DecimalLike | null }[] | null,
): { home: Decimal; away: Decimal } | null {
  if (rows === null) return null;
  const homeRow = rows.find((r) => r.pick === "HOME");
  const awayRow = rows.find((r) => r.pick === "AWAY");
  if (!homeRow?.odds || !awayRow?.odds) return null;
  return {
    home: new Decimal(homeRow.odds.toString()),
    away: new Decimal(awayRow.odds.toString()),
  };
}

// NOT used for markets whose outcomes partition a single coherent event
// (ONE_X_TWO, FIRST_HALF_WINNER, DOUBLE_CHANCE, HALF_TIME_FULL_TIME) — mixing
// bookmakers across those outcomes would recreate the fabricated-triplet risk
// fixed 2026-08-15 in assembleFullOddsSnapshot's ONE_X_TWO leg (a combination
// no single real bookmaker ever offered, with an artificially low overround).
export function resolvePerPickOddsPerLine<T extends string>(
  rows: RawOddsRow[],
  market: Market,
  opts: { cutoff: Date; validKeys?: readonly T[] },
): Partial<Record<T, Decimal>> {
  const { cutoff, validKeys } = opts;
  const byPick = new Map<string, RawOddsRow[]>();
  for (const row of rows) {
    if (row.market !== market || row.odds === null || !row.pick) continue;
    if (row.snapshotAt.getTime() > cutoff.getTime()) continue;
    if (validKeys && !(validKeys as readonly string[]).includes(row.pick)) {
      continue;
    }
    const list = byPick.get(row.pick);
    if (list) list.push(row);
    else byPick.set(row.pick, [row]);
  }
  const result: Partial<Record<T, Decimal>> = {};
  for (const [pick, pickRows] of byPick) {
    const latestTs = Math.max(...pickRows.map((r) => r.snapshotAt.getTime()));
    const atLatest = pickRows.filter(
      (r) => r.snapshotAt.getTime() === latestTs,
    );
    const best = atLatest.reduce((a, b) =>
      bookmakerRank(a.bookmaker) <= bookmakerRank(b.bookmaker) ? a : b,
    );
    result[pick as T] = new Decimal(best.odds!.toString());
  }
  return result;
}

function resolveOverUnderOddsPerLine(
  rows: RawOddsRow[],
  cutoff: Date,
): FullOddsSnapshot["overUnderOdds"] {
  return resolvePerPickOddsPerLine(rows, Market.OVER_UNDER, {
    cutoff,
    validKeys: OVER_UNDER_PICKS,
  });
}

// Best bookmaker for a market as of `cutoff`: latest snapshotAt not after
// cutoff, ties broken by bookmakerRank. Fixed 2026-08-17 (point-in-time
// audit triggered by the backtest-harness cadrage, docs/backtest-harness-
// architecture.md) — this used to ignore `cutoff` entirely for every market
// except ONE_X_TWO, so callers silently got the newest odds in the DB
// regardless of the requested instant for BTTS/HT-FT/First Half
// Winner/Double Chance/Draw No Bet/Clean Sheet/Win to Nil/Win Either Half —
// corrupting both the live line-movement filter (`cutoff7d` in
// analyzeFixture) and any backtest replaying a past date on those markets.
export function pickBestBookmaker(
  rows: RawOddsRow[],
  market: Market,
  cutoff: Date,
): string | null {
  const marketRows = rows.filter(
    (r) =>
      r.market === market &&
      r.odds !== null &&
      r.snapshotAt.getTime() <= cutoff.getTime(),
  );
  if (marketRows.length === 0) return null;
  const latestTs = Math.max(...marketRows.map((r) => r.snapshotAt.getTime()));
  const seen = new Set<string>();
  const atLatest = marketRows
    .filter((r) => r.snapshotAt.getTime() === latestTs)
    .filter((r) => (seen.has(r.bookmaker) ? false : seen.add(r.bookmaker)));
  return atLatest.reduce((a, b) =>
    bookmakerRank(a.bookmaker) <= bookmakerRank(b.bookmaker) ? a : b,
  ).bookmaker;
}

// Rows for one (market, bookmaker) as of `cutoff`, newest first — same "most
// recent wins" ordering the original per-market queries relied on for
// parse*/find(). Cutoff-filtered so a bookmaker's price update after the
// requested instant can't leak in even once the bookmaker itself is chosen
// correctly (see pickBestBookmaker's 2026-08-17 fix note).
export function rowsForMarketBookmaker(
  rows: RawOddsRow[],
  opts: { market: Market; bookmaker: string | null; cutoff: Date },
): { pick: string | null; odds: DecimalLike | null }[] {
  const { market, bookmaker, cutoff } = opts;
  if (bookmaker === null) return [];
  return rows
    .filter(
      (r) =>
        r.market === market &&
        r.bookmaker === bookmaker &&
        r.snapshotAt.getTime() <= cutoff.getTime(),
    )
    .sort((a, b) => b.snapshotAt.getTime() - a.snapshotAt.getTime());
}

// Pure, DB-independent assembly of a fixture's FullOddsSnapshot from every
// oddsSnapshot row it has (any market/bookmaker/time), as of `cutoff`. The
// single source of truth for "what did the market look like at this exact
// instant" — used by the live betting engine (cutoff = now, or now-7d for
// the line-movement filter) and by the backtest harness (cutoff = the
// fixture's kickoff, walking forward through history).
export function assembleFullOddsSnapshot(
  rows: RawOddsRow[],
  cutoff: Date,
): FullOddsSnapshot | null {
  const oneXTwoRows = rows.filter(
    (r) =>
      r.market === Market.ONE_X_TWO &&
      r.snapshotAt.getTime() <= cutoff.getTime() &&
      r.homeOdds !== null &&
      r.drawOdds !== null &&
      r.awayOdds !== null,
  );
  if (oneXTwoRows.length === 0) return null;

  const latestSnapshotAt = Math.max(
    ...oneXTwoRows.map((r) => r.snapshotAt.getTime()),
  );
  const sameSnapshotRows = oneXTwoRows.filter(
    (r) => r.snapshotAt.getTime() === latestSnapshotAt,
  );
  const best = sameSnapshotRows.reduce((a, b) =>
    bookmakerRank(a.bookmaker) <= bookmakerRank(b.bookmaker) ? a : b,
  );
  if (
    best.homeOdds === null ||
    best.drawOdds === null ||
    best.awayOdds === null
  ) {
    return null;
  }

  const rowsFor = (market: Market) =>
    rowsForMarketBookmaker(rows, {
      market,
      bookmaker: pickBestBookmaker(rows, market, cutoff),
      cutoff,
    });

  const htftRows = rowsFor(Market.HALF_TIME_FULL_TIME);
  const fhwRows = rowsFor(Market.FIRST_HALF_WINNER);
  const dcRows = rowsFor(Market.DOUBLE_CHANCE);
  const dnbRows = rowsFor(Market.DRAW_NO_BET);
  const csHomeRows = rowsFor(Market.CLEAN_SHEET_HOME);
  const csAwayRows = rowsFor(Market.CLEAN_SHEET_AWAY);
  const wtnHomeRows = rowsFor(Market.WIN_TO_NIL_HOME);
  const wtnAwayRows = rowsFor(Market.WIN_TO_NIL_AWAY);
  const twhRows = rowsFor(Market.TO_WIN_EITHER_HALF);
  const bttsBookmaker = pickBestBookmaker(rows, Market.BTTS, cutoff);
  const bttsRows = rowsForMarketBookmaker(rows, {
    market: Market.BTTS,
    bookmaker: bttsBookmaker,
    cutoff,
  });
  const bttsYesRow = bttsRows.find((r) => r.pick === "YES") ?? null;
  const bttsNoRow = bttsRows.find((r) => r.pick === "NO") ?? null;

  const htftOdds = {} as Partial<Record<HalfTimeFullTimePick, Decimal>>;
  const overUnderOdds = resolveOverUnderOddsPerLine(rows, cutoff);
  const ouHtOdds = resolvePerPickOddsPerLine(rows, Market.OVER_UNDER_HT, {
    cutoff,
    validKeys: OU_HT_PICKS,
  });
  let firstHalfWinnerOdds: FullOddsSnapshot["firstHalfWinnerOdds"] = null;
  let doubleChanceOdds: FullOddsSnapshot["doubleChanceOdds"] = null;

  for (const row of htftRows) {
    if (!row.pick || !row.odds) continue;
    if (!(row.pick in htftOdds) && isHalfTimeFullTimePick(row.pick)) {
      htftOdds[row.pick] = new Decimal(row.odds.toString());
    }
  }
  {
    const homeRow = fhwRows.find((r) => r.pick === "HOME");
    const drawRow = fhwRows.find((r) => r.pick === "DRAW");
    const awayRow = fhwRows.find((r) => r.pick === "AWAY");
    if (homeRow?.odds && drawRow?.odds && awayRow?.odds) {
      firstHalfWinnerOdds = {
        home: new Decimal(homeRow.odds.toString()),
        draw: new Decimal(drawRow.odds.toString()),
        away: new Decimal(awayRow.odds.toString()),
      };
    }
  }
  {
    const row1X = dcRows.find((r) => r.pick === "1X");
    const rowX2 = dcRows.find((r) => r.pick === "X2");
    const row12 = dcRows.find((r) => r.pick === "12");
    if (row1X?.odds && rowX2?.odds) {
      doubleChanceOdds = {
        "1X": new Decimal(row1X.odds.toString()),
        X2: new Decimal(rowX2.odds.toString()),
        "12": row12?.odds ? new Decimal(row12.odds.toString()) : null,
      };
    }
  }

  let drawNoBetOdds: FullOddsSnapshot["drawNoBetOdds"] = null;
  {
    const homeRow = dnbRows.find((r) => r.pick === "HOME");
    const awayRow = dnbRows.find((r) => r.pick === "AWAY");
    if (homeRow?.odds && awayRow?.odds) {
      drawNoBetOdds = {
        home: new Decimal(homeRow.odds.toString()),
        away: new Decimal(awayRow.odds.toString()),
      };
    }
  }

  const teamTotalHomeOdds = resolvePerPickOddsPerLine(
    rows,
    Market.TEAM_TOTAL_HOME,
    { cutoff, validKeys: TEAM_TOTAL_PICKS },
  );
  const teamTotalAwayOdds = resolvePerPickOddsPerLine(
    rows,
    Market.TEAM_TOTAL_AWAY,
    { cutoff, validKeys: TEAM_TOTAL_PICKS },
  );
  const cleanSheetHomeOdds = parseYesNoRows(csHomeRows);
  const cleanSheetAwayOdds = parseYesNoRows(csAwayRows);
  const winToNilHomeOdds = parseYesNoRows(wtnHomeRows);
  const winToNilAwayOdds = parseYesNoRows(wtnAwayRows);
  const winEitherHalfOdds = parseHomeAwayRows(twhRows);
  const resultTotalGoalsOdds = resolvePerPickOddsPerLine(
    rows,
    Market.RESULT_TOTAL_GOALS,
    { cutoff, validKeys: RESULT_TOTAL_GOALS_PICKS },
  );
  const resultBttsOdds = resolvePerPickOddsPerLine(rows, Market.RESULT_BTTS, {
    cutoff,
    validKeys: RESULT_BTTS_PICKS,
  });
  const correctScoreOdds = resolvePerPickOddsPerLine<string>(
    rows,
    Market.CORRECT_SCORE,
    { cutoff },
  );

  return {
    bookmaker: best.bookmaker,
    snapshotAt: best.snapshotAt,
    homeOdds: new Decimal(best.homeOdds.toString()),
    drawOdds: new Decimal(best.drawOdds.toString()),
    awayOdds: new Decimal(best.awayOdds.toString()),
    overUnderOdds,
    bttsYesOdds: bttsYesRow?.odds
      ? new Decimal(bttsYesRow.odds.toString())
      : null,
    bttsNoOdds: bttsNoRow?.odds ? new Decimal(bttsNoRow.odds.toString()) : null,
    htftOdds,
    ouHtOdds,
    firstHalfWinnerOdds,
    doubleChanceOdds,
    correctScoreOdds,
    drawNoBetOdds,
    teamTotalHomeOdds,
    teamTotalAwayOdds,
    cleanSheetHomeOdds,
    cleanSheetAwayOdds,
    winToNilHomeOdds,
    winToNilAwayOdds,
    winEitherHalfOdds,
    resultTotalGoalsOdds,
    resultBttsOdds,
  };
}
