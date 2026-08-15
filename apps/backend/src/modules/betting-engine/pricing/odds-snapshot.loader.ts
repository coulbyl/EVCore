import { Injectable } from '@nestjs/common';
import { Market, Prisma } from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';
import { isHalfTimeFullTimePick } from '../betting-engine.utils';
import type { HalfTimeFullTimePick } from '../betting-engine.utils';
import type { FullOddsSnapshot } from '../betting-engine.types';

// Bookmaker preference order when several offer the same market at the same
// snapshot timestamp. Lower rank wins (sharpest book first).
function bookmakerRank(bookmaker: string): number {
  if (bookmaker === 'Pinnacle') return 0;
  if (bookmaker === 'Bet365') return 1;
  if (bookmaker === 'Unibet') return 2;
  if (bookmaker === 'Marathonbet') return 3;
  if (bookmaker === 'Bwin') return 4;
  if (bookmaker === 'MarketAvg') return 5;
  return 6;
}

// The 8 sparse OVER_UNDER lines (bare 2.5 + 1.5/3.5/4.5), each an independent
// binary market — unlike ONE_X_TWO's correlated home/draw/away triplet, a
// bookmaker covering one line says nothing about whether it covers another.
const OVER_UNDER_PICKS = [
  'OVER_1_5',
  'UNDER_1_5',
  'OVER',
  'UNDER',
  'OVER_3_5',
  'UNDER_3_5',
  'OVER_4_5',
  'UNDER_4_5',
] as const;

const OU_HT_PICKS = ['OVER_0_5', 'UNDER_0_5', 'OVER_1_5', 'UNDER_1_5'] as const;

// Generic fix for the "bookmaker per market entire" data-loss bug (audit
// 2026-08-13, first confirmed on OVER_UNDER — Nordsjaelland–Valur's 2.5 line
// vanished from evaluatedPicks because a different bookmaker was picked for
// the whole market and hadn't quoted that line at the latest snapshot).
// Resolves the best bookmaker independently PER PICK instead of once for the
// whole market — every pick here is an INDEPENDENT sub-market (a distinct
// goal line, side+line combo, or scoreline), so a bookmaker covering one says
// nothing about whether it covers another.
//
// NOT used for markets whose outcomes partition a single coherent event
// (ONE_X_TWO, FIRST_HALF_WINNER, DOUBLE_CHANCE, HALF_TIME_FULL_TIME) — mixing
// bookmakers across those outcomes would recreate the fabricated-triplet risk
// fixed in findLatestBestOneXTwoOddsSnapshot (a combination no single real
// bookmaker ever offered, with an artificially low overround).
function resolvePerPickOddsPerLine<T extends string>(
  rows: RawOddsRow[],
  market: Market,
  validKeys?: readonly T[],
): Partial<Record<T, Decimal>> {
  const byPick = new Map<string, RawOddsRow[]>();
  for (const row of rows) {
    if (row.market !== market || row.odds === null || !row.pick) continue;
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
): FullOddsSnapshot['overUnderOdds'] {
  return resolvePerPickOddsPerLine(rows, Market.OVER_UNDER, OVER_UNDER_PICKS);
}

const TEAM_TOTAL_PICKS = [
  'OVER_0_5',
  'UNDER_0_5',
  'OVER_1_5',
  'UNDER_1_5',
  'OVER_2_5',
  'UNDER_2_5',
  'OVER_3_5',
  'UNDER_3_5',
  'OVER_4_5',
  'UNDER_4_5',
  'OVER_5_5',
  'UNDER_5_5',
  'OVER_6_5',
  'UNDER_6_5',
] as const;

const RESULT_TOTAL_GOALS_PICKS = (['HOME', 'DRAW', 'AWAY'] as const).flatMap(
  (side) =>
    (['1_5', '2_5', '3_5', '4_5'] as const).flatMap((line) => [
      `${side}_OVER_${line}` as const,
      `${side}_UNDER_${line}` as const,
    ]),
);

const RESULT_BTTS_PICKS = (['HOME', 'DRAW', 'AWAY'] as const).flatMap(
  (side) => [`${side}_YES` as const, `${side}_NO` as const],
);

function parseYesNoRows(
  rows: { pick: string | null; odds: Prisma.Decimal | null }[] | null,
): { yes: Decimal; no: Decimal } | null {
  if (rows === null) return null;
  const yesRow = rows.find((r) => r.pick === 'YES');
  const noRow = rows.find((r) => r.pick === 'NO');
  if (!yesRow?.odds || !noRow?.odds) return null;
  return {
    yes: new Decimal(yesRow.odds.toString()),
    no: new Decimal(noRow.odds.toString()),
  };
}

function parseHomeAwayRows(
  rows: { pick: string | null; odds: Prisma.Decimal | null }[] | null,
): { home: Decimal; away: Decimal } | null {
  if (rows === null) return null;
  const homeRow = rows.find((r) => r.pick === 'HOME');
  const awayRow = rows.find((r) => r.pick === 'AWAY');
  if (!homeRow?.odds || !awayRow?.odds) return null;
  return {
    home: new Decimal(homeRow.odds.toString()),
    away: new Decimal(awayRow.odds.toString()),
  };
}

type RawOddsRow = {
  bookmaker: string;
  market: Market;
  pick: string | null;
  odds: Prisma.Decimal | null;
  snapshotAt: Date;
  homeOdds: Prisma.Decimal | null;
  drawOdds: Prisma.Decimal | null;
  awayOdds: Prisma.Decimal | null;
};

// Best bookmaker for a market: latest snapshotAt, ties broken by bookmakerRank
// — same selection as the original per-market query. Note: like the original,
// this does NOT apply `cutoff` (only the ONE_X_TWO leg below does) — preserved
// as-is rather than silently changed while refactoring.
function pickBestBookmaker(rows: RawOddsRow[], market: Market): string | null {
  const marketRows = rows.filter((r) => r.market === market && r.odds !== null);
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

// Rows for one (market, bookmaker), newest first — same "most recent wins"
// ordering the original per-market Prisma queries relied on for parse*/find().
function rowsForMarketBookmaker(
  rows: RawOddsRow[],
  market: Market,
  bookmaker: string | null,
): { pick: string | null; odds: Prisma.Decimal | null }[] {
  if (bookmaker === null) return [];
  return rows
    .filter((r) => r.market === market && r.bookmaker === bookmaker)
    .sort((a, b) => b.snapshotAt.getTime() - a.snapshotAt.getTime());
}

// Pure, DB-independent assembly of a fixture's FullOddsSnapshot from every
// oddsSnapshot row it has (any market/bookmaker/time) — the single source of
// truth for both findLatestOddsSnapshot (one fixture, one query) and
// findLatestOddsSnapshotsBatch (many fixtures, one query, grouped in memory).
// Reproduces exactly what the pre-refactor per-market Prisma calls computed.
function assembleFullOddsSnapshot(
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
    rowsForMarketBookmaker(rows, market, pickBestBookmaker(rows, market));

  const htftRows = rowsFor(Market.HALF_TIME_FULL_TIME);
  const fhwRows = rowsFor(Market.FIRST_HALF_WINNER);
  const dcRows = rowsFor(Market.DOUBLE_CHANCE);
  const dnbRows = rowsFor(Market.DRAW_NO_BET);
  const csHomeRows = rowsFor(Market.CLEAN_SHEET_HOME);
  const csAwayRows = rowsFor(Market.CLEAN_SHEET_AWAY);
  const wtnHomeRows = rowsFor(Market.WIN_TO_NIL_HOME);
  const wtnAwayRows = rowsFor(Market.WIN_TO_NIL_AWAY);
  const twhRows = rowsFor(Market.TO_WIN_EITHER_HALF);
  const bttsBookmaker = pickBestBookmaker(rows, Market.BTTS);
  const bttsRows = rowsForMarketBookmaker(rows, Market.BTTS, bttsBookmaker);
  const bttsYesRow = bttsRows.find((r) => r.pick === 'YES') ?? null;
  const bttsNoRow = bttsRows.find((r) => r.pick === 'NO') ?? null;

  const htftOdds = {} as Partial<Record<HalfTimeFullTimePick, Decimal>>;
  const overUnderOdds = resolveOverUnderOddsPerLine(rows);
  const ouHtOdds = resolvePerPickOddsPerLine(
    rows,
    Market.OVER_UNDER_HT,
    OU_HT_PICKS,
  );
  let firstHalfWinnerOdds: FullOddsSnapshot['firstHalfWinnerOdds'] = null;
  let doubleChanceOdds: FullOddsSnapshot['doubleChanceOdds'] = null;

  for (const row of htftRows) {
    if (!row.pick || !row.odds) continue;
    if (!(row.pick in htftOdds) && isHalfTimeFullTimePick(row.pick)) {
      htftOdds[row.pick] = new Decimal(row.odds.toString());
    }
  }
  {
    const homeRow = fhwRows.find((r) => r.pick === 'HOME');
    const drawRow = fhwRows.find((r) => r.pick === 'DRAW');
    const awayRow = fhwRows.find((r) => r.pick === 'AWAY');
    if (homeRow?.odds && drawRow?.odds && awayRow?.odds) {
      firstHalfWinnerOdds = {
        home: new Decimal(homeRow.odds.toString()),
        draw: new Decimal(drawRow.odds.toString()),
        away: new Decimal(awayRow.odds.toString()),
      };
    }
  }
  {
    const row1X = dcRows.find((r) => r.pick === '1X');
    const rowX2 = dcRows.find((r) => r.pick === 'X2');
    const row12 = dcRows.find((r) => r.pick === '12');
    if (row1X?.odds && rowX2?.odds) {
      doubleChanceOdds = {
        '1X': new Decimal(row1X.odds.toString()),
        X2: new Decimal(rowX2.odds.toString()),
        '12': row12?.odds ? new Decimal(row12.odds.toString()) : null,
      };
    }
  }

  let drawNoBetOdds: FullOddsSnapshot['drawNoBetOdds'] = null;
  {
    const homeRow = dnbRows.find((r) => r.pick === 'HOME');
    const awayRow = dnbRows.find((r) => r.pick === 'AWAY');
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
    TEAM_TOTAL_PICKS,
  );
  const teamTotalAwayOdds = resolvePerPickOddsPerLine(
    rows,
    Market.TEAM_TOTAL_AWAY,
    TEAM_TOTAL_PICKS,
  );
  const cleanSheetHomeOdds = parseYesNoRows(csHomeRows);
  const cleanSheetAwayOdds = parseYesNoRows(csAwayRows);
  const winToNilHomeOdds = parseYesNoRows(wtnHomeRows);
  const winToNilAwayOdds = parseYesNoRows(wtnAwayRows);
  const winEitherHalfOdds = parseHomeAwayRows(twhRows);
  const resultTotalGoalsOdds = resolvePerPickOddsPerLine(
    rows,
    Market.RESULT_TOTAL_GOALS,
    RESULT_TOTAL_GOALS_PICKS,
  );
  const resultBttsOdds = resolvePerPickOddsPerLine(
    rows,
    Market.RESULT_BTTS,
    RESULT_BTTS_PICKS,
  );
  const correctScoreOdds = resolvePerPickOddsPerLine<string>(
    rows,
    Market.CORRECT_SCORE,
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

const RAW_ODDS_ROW_SELECT = {
  fixtureId: true,
  bookmaker: true,
  market: true,
  pick: true,
  odds: true,
  snapshotAt: true,
  homeOdds: true,
  drawOdds: true,
  awayOdds: true,
} as const;

/**
 * Data-access for odds snapshots. Resolves the consolidated, as-of view of a
 * fixture's market odds (best bookmaker per market) used by the betting engine.
 * Extracted verbatim from BettingEngineService — pure reads, no scoring logic.
 */
@Injectable()
export class OddsSnapshotLoader {
  constructor(private readonly prisma: PrismaService) {}

  private async findBestBookmakerForMarket(
    fixtureId: string,
    market: Market,
    _cutoff: Date,
  ): Promise<string | null> {
    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId,
        market,
        odds: { not: null },
      },
      select: { bookmaker: true, snapshotAt: true },
      orderBy: { snapshotAt: 'desc' },
    });
    if (rows.length === 0) return null;
    const latestTs = rows[0].snapshotAt.getTime();
    const seen = new Set<string>();
    const atLatest = rows
      .filter((r) => r.snapshotAt.getTime() === latestTs)
      .filter((r) => (seen.has(r.bookmaker) ? false : seen.add(r.bookmaker)));
    return atLatest.reduce((a, b) =>
      bookmakerRank(a.bookmaker) <= bookmakerRank(b.bookmaker) ? a : b,
    ).bookmaker;
  }

  // Same fix as resolvePerPickOddsPerLine (batch path) applied to the
  // single-fixture query path: resolves the best bookmaker independently per
  // pick instead of once for the whole market, so a pick quoted only by a
  // non-"best" bookmaker at the latest snapshot isn't silently dropped from
  // evaluatedPicks (audit 2026-08-13). Only for markets whose picks are
  // independent sub-markets — see resolvePerPickOddsPerLine's comment for the
  // markets this must NOT be used for.
  private async findPerPickOddsPerLine<T extends string>(
    fixtureId: string,
    market: Market,
    validKeys?: readonly T[],
  ): Promise<Partial<Record<T, Decimal>>> {
    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId,
        market,
        odds: { not: null },
      },
      select: { bookmaker: true, pick: true, odds: true, snapshotAt: true },
    });

    const byPick = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!row.pick) continue;
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

  async findLatestOddsSnapshot(
    fixtureId: string,
    cutoff: Date,
  ): Promise<FullOddsSnapshot | null> {
    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId,
        market: Market.ONE_X_TWO,
        snapshotAt: { lte: cutoff },
        homeOdds: { not: null },
        drawOdds: { not: null },
        awayOdds: { not: null },
      },
      select: {
        bookmaker: true,
        snapshotAt: true,
        homeOdds: true,
        drawOdds: true,
        awayOdds: true,
      },
      orderBy: { snapshotAt: 'desc' },
    });

    if (rows.length === 0) return null;

    const latestSnapshotAt = rows[0].snapshotAt.getTime();
    const sameSnapshotRows = rows.filter(
      (row) => row.snapshotAt.getTime() === latestSnapshotAt,
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

    // Resolve the best available bookmaker for each secondary market
    // independently — their coverage differs from 1X2 (e.g. Pinnacle covers
    // OVER_UNDER while Bet365 may not). Sparse-pick markets (each pick an
    // independent sub-market) resolve per pick via findPerPickOddsPerLine;
    // coherent single-event markets (HT/FT, First-Half Winner, Double Chance)
    // still resolve one bookmaker for the whole market — see
    // resolvePerPickOddsPerLine's comment for why those must stay that way.
    const [
      overUnderOdds,
      ouHtOdds,
      teamTotalHomeOdds,
      teamTotalAwayOdds,
      resultTotalGoalsOdds,
      resultBttsOdds,
      correctScoreOdds,
      bttsBookmaker,
      htftBookmaker,
      fhwBookmaker,
      dcBookmaker,
      dnbBookmaker,
      csHomeBookmaker,
      csAwayBookmaker,
      wtnHomeBookmaker,
      wtnAwayBookmaker,
      twhBookmaker,
    ] = await Promise.all([
      this.findPerPickOddsPerLine(
        fixtureId,
        Market.OVER_UNDER,
        OVER_UNDER_PICKS,
      ),
      this.findPerPickOddsPerLine(fixtureId, Market.OVER_UNDER_HT, OU_HT_PICKS),
      this.findPerPickOddsPerLine(
        fixtureId,
        Market.TEAM_TOTAL_HOME,
        TEAM_TOTAL_PICKS,
      ),
      this.findPerPickOddsPerLine(
        fixtureId,
        Market.TEAM_TOTAL_AWAY,
        TEAM_TOTAL_PICKS,
      ),
      this.findPerPickOddsPerLine(
        fixtureId,
        Market.RESULT_TOTAL_GOALS,
        RESULT_TOTAL_GOALS_PICKS,
      ),
      this.findPerPickOddsPerLine(
        fixtureId,
        Market.RESULT_BTTS,
        RESULT_BTTS_PICKS,
      ),
      this.findPerPickOddsPerLine<string>(fixtureId, Market.CORRECT_SCORE),
      this.findBestBookmakerForMarket(fixtureId, Market.BTTS, cutoff),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.HALF_TIME_FULL_TIME,
        cutoff,
      ),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.FIRST_HALF_WINNER,
        cutoff,
      ),
      this.findBestBookmakerForMarket(fixtureId, Market.DOUBLE_CHANCE, cutoff),
      this.findBestBookmakerForMarket(fixtureId, Market.DRAW_NO_BET, cutoff),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.CLEAN_SHEET_HOME,
        cutoff,
      ),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.CLEAN_SHEET_AWAY,
        cutoff,
      ),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.WIN_TO_NIL_HOME,
        cutoff,
      ),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.WIN_TO_NIL_AWAY,
        cutoff,
      ),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.TO_WIN_EITHER_HALF,
        cutoff,
      ),
    ]);

    const [
      bttsYesRow,
      bttsNoRow,
      htftRows,
      fhwRows,
      dcRows,
      dnbRows,
      csHomeRows,
      csAwayRows,
      wtnHomeRows,
      wtnAwayRows,
      twhRows,
    ] = await Promise.all([
      bttsBookmaker
        ? this.prisma.client.oddsSnapshot.findFirst({
            where: {
              fixtureId,
              bookmaker: bttsBookmaker,
              market: Market.BTTS,
              pick: 'YES',
            },
            select: { odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
      bttsBookmaker
        ? this.prisma.client.oddsSnapshot.findFirst({
            where: {
              fixtureId,
              bookmaker: bttsBookmaker,
              market: Market.BTTS,
              pick: 'NO',
            },
            select: { odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
      htftBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: htftBookmaker,
              market: Market.HALF_TIME_FULL_TIME,
            },
            select: { pick: true, odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : [],
      fhwBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: fhwBookmaker,
              market: Market.FIRST_HALF_WINNER,
            },
            select: { pick: true, odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
      dcBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: dcBookmaker,
              market: Market.DOUBLE_CHANCE,
            },
            select: { pick: true, odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
      dnbBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: dnbBookmaker,
              market: Market.DRAW_NO_BET,
            },
            select: { pick: true, odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
      csHomeBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: csHomeBookmaker,
              market: Market.CLEAN_SHEET_HOME,
            },
            select: { pick: true, odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
      csAwayBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: csAwayBookmaker,
              market: Market.CLEAN_SHEET_AWAY,
            },
            select: { pick: true, odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
      wtnHomeBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: wtnHomeBookmaker,
              market: Market.WIN_TO_NIL_HOME,
            },
            select: { pick: true, odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
      wtnAwayBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: wtnAwayBookmaker,
              market: Market.WIN_TO_NIL_AWAY,
            },
            select: { pick: true, odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
      twhBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: twhBookmaker,
              market: Market.TO_WIN_EITHER_HALF,
            },
            select: { pick: true, odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
    ]);

    const htftOdds = {} as Partial<Record<HalfTimeFullTimePick, Decimal>>;
    let firstHalfWinnerOdds: FullOddsSnapshot['firstHalfWinnerOdds'] = null;
    let doubleChanceOdds: FullOddsSnapshot['doubleChanceOdds'] = null;

    for (const row of htftRows) {
      if (!row.pick || !row.odds) continue;
      if (!(row.pick in htftOdds) && isHalfTimeFullTimePick(row.pick)) {
        htftOdds[row.pick] = new Decimal(row.odds.toString());
      }
    }
    if (fhwRows !== null) {
      const homeRow = fhwRows.find((r) => r.pick === 'HOME');
      const drawRow = fhwRows.find((r) => r.pick === 'DRAW');
      const awayRow = fhwRows.find((r) => r.pick === 'AWAY');
      if (homeRow?.odds && drawRow?.odds && awayRow?.odds) {
        firstHalfWinnerOdds = {
          home: new Decimal(homeRow.odds.toString()),
          draw: new Decimal(drawRow.odds.toString()),
          away: new Decimal(awayRow.odds.toString()),
        };
      }
    }
    if (dcRows !== null) {
      const row1X = dcRows.find((r) => r.pick === '1X');
      const rowX2 = dcRows.find((r) => r.pick === 'X2');
      const row12 = dcRows.find((r) => r.pick === '12');
      if (row1X?.odds && rowX2?.odds) {
        doubleChanceOdds = {
          '1X': new Decimal(row1X.odds.toString()),
          X2: new Decimal(rowX2.odds.toString()),
          '12': row12?.odds ? new Decimal(row12.odds.toString()) : null,
        };
      }
    }

    let drawNoBetOdds: FullOddsSnapshot['drawNoBetOdds'] = null;
    if (dnbRows !== null) {
      const homeRow = dnbRows.find((r) => r.pick === 'HOME');
      const awayRow = dnbRows.find((r) => r.pick === 'AWAY');
      if (homeRow?.odds && awayRow?.odds) {
        drawNoBetOdds = {
          home: new Decimal(homeRow.odds.toString()),
          away: new Decimal(awayRow.odds.toString()),
        };
      }
    }

    const cleanSheetHomeOdds = parseYesNoRows(csHomeRows);
    const cleanSheetAwayOdds = parseYesNoRows(csAwayRows);
    const winToNilHomeOdds = parseYesNoRows(wtnHomeRows);
    const winToNilAwayOdds = parseYesNoRows(wtnAwayRows);
    const winEitherHalfOdds = parseHomeAwayRows(twhRows);

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
      bttsNoOdds: bttsNoRow?.odds
        ? new Decimal(bttsNoRow.odds.toString())
        : null,
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

  // Batched counterpart of findLatestOddsSnapshot — one query for every
  // fixture instead of one per fixture (findLatestOddsSnapshot alone runs
  // ~34 sequential Prisma calls per fixture). Built on the same pure
  // assembleFullOddsSnapshot() used nowhere else — kept deliberately
  // separate from findLatestOddsSnapshot so its existing, tested per-market
  // bookmaker-resolution behaviour above is untouched. Used by pool builders
  // that score many fixtures at once (SignalWindowService.getTodayPool /
  // getPoolForRange).
  async findLatestOddsSnapshotsBatch(
    requests: Array<{ fixtureId: string; cutoff: Date }>,
  ): Promise<Map<string, FullOddsSnapshot | null>> {
    const result = new Map<string, FullOddsSnapshot | null>();
    if (requests.length === 0) return result;

    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: { fixtureId: { in: requests.map((r) => r.fixtureId) } },
      select: RAW_ODDS_ROW_SELECT,
    });

    const rowsByFixture = new Map<string, RawOddsRow[]>();
    for (const row of rows) {
      const bucket = rowsByFixture.get(row.fixtureId);
      if (bucket) bucket.push(row);
      else rowsByFixture.set(row.fixtureId, [row]);
    }

    for (const { fixtureId, cutoff } of requests) {
      result.set(
        fixtureId,
        assembleFullOddsSnapshot(rowsByFixture.get(fixtureId) ?? [], cutoff),
      );
    }
    return result;
  }

  async findLatestOneXTwoOddsSnapshotByBookmaker(
    fixtureId: string,
    _cutoff: Date,
    bookmaker: string,
  ): Promise<FullOddsSnapshot | null> {
    const row = await this.prisma.client.oddsSnapshot.findFirst({
      where: {
        fixtureId,
        market: Market.ONE_X_TWO,
        bookmaker,
        homeOdds: { not: null },
        drawOdds: { not: null },
        awayOdds: { not: null },
      },
      select: {
        bookmaker: true,
        snapshotAt: true,
        homeOdds: true,
        drawOdds: true,
        awayOdds: true,
      },
      orderBy: { snapshotAt: 'desc' },
    });

    if (
      row === null ||
      row.homeOdds === null ||
      row.drawOdds === null ||
      row.awayOdds === null
    ) {
      return null;
    }

    return {
      bookmaker: row.bookmaker,
      snapshotAt: row.snapshotAt,
      homeOdds: new Decimal(row.homeOdds.toString()),
      drawOdds: new Decimal(row.drawOdds.toString()),
      awayOdds: new Decimal(row.awayOdds.toString()),
      overUnderOdds: {},
      bttsYesOdds: null,
      bttsNoOdds: null,
      htftOdds: {},
      ouHtOdds: {},
      firstHalfWinnerOdds: null,
      doubleChanceOdds: null,
      drawNoBetOdds: null,
      teamTotalHomeOdds: {},
      teamTotalAwayOdds: {},
      cleanSheetHomeOdds: null,
      cleanSheetAwayOdds: null,
      winToNilHomeOdds: null,
      winToNilAwayOdds: null,
      winEitherHalfOdds: null,
      resultTotalGoalsOdds: {},
      resultBttsOdds: {},
    };
  }

  // "Best" = the single real bookmaker with the lowest overround among those
  // quoting a complete triplet — NOT the highest home odds, highest draw odds
  // and highest away odds independently picked across different bookmakers.
  // The latter (fixed 2026-08-15, audit 2026-08-13) fabricated a triplet that
  // never existed at any one bookmaker: mixing each side's best price across
  // books produces an overround lower than any real book ever offered,
  // systematically inflating every EV computed against it — and this snapshot
  // feeds listEvaluatedPicks/listEvaluatedOneXTwoPicks directly in the FRI
  // channel (betting-engine.service.ts analyzeFriFixture), not just a display
  // value. Returning one bookmaker's real, coherent triplet fixes that while
  // keeping the "shop for the best real price" intent.
  async findLatestBestOneXTwoOddsSnapshot(
    fixtureId: string,
    _cutoff: Date,
  ): Promise<{
    snapshot: FullOddsSnapshot;
    offeredBy: { home: string; draw: string; away: string };
  } | null> {
    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId,
        market: Market.ONE_X_TWO,
        homeOdds: { not: null },
        drawOdds: { not: null },
        awayOdds: { not: null },
      },
      select: {
        bookmaker: true,
        snapshotAt: true,
        homeOdds: true,
        drawOdds: true,
        awayOdds: true,
      },
      orderBy: [{ snapshotAt: 'desc' }, { bookmaker: 'asc' }],
    });

    if (rows.length === 0) return null;

    const latestByBookmaker = new Map<
      string,
      {
        bookmaker: string;
        snapshotAt: Date;
        homeOdds: Prisma.Decimal | null;
        drawOdds: Prisma.Decimal | null;
        awayOdds: Prisma.Decimal | null;
      }
    >();
    for (const row of rows) {
      if (!latestByBookmaker.has(row.bookmaker)) {
        latestByBookmaker.set(row.bookmaker, row);
      }
    }

    const latestRows = Array.from(latestByBookmaker.values()).filter(
      (row) =>
        row.homeOdds !== null && row.drawOdds !== null && row.awayOdds !== null,
    );
    if (latestRows.length === 0) return null;

    const overround = (row: (typeof latestRows)[number]): Decimal =>
      new Decimal(1)
        .div(row.homeOdds!.toString())
        .plus(new Decimal(1).div(row.drawOdds!.toString()))
        .plus(new Decimal(1).div(row.awayOdds!.toString()));

    const best = latestRows.reduce((a, b) =>
      overround(a).lessThanOrEqualTo(overround(b)) ? a : b,
    );

    return {
      snapshot: {
        bookmaker: best.bookmaker,
        snapshotAt: best.snapshotAt,
        homeOdds: new Decimal(best.homeOdds!.toString()),
        drawOdds: new Decimal(best.drawOdds!.toString()),
        awayOdds: new Decimal(best.awayOdds!.toString()),
        overUnderOdds: {},
        bttsYesOdds: null,
        bttsNoOdds: null,
        htftOdds: {},
        ouHtOdds: {},
        firstHalfWinnerOdds: null,
        doubleChanceOdds: null,
        drawNoBetOdds: null,
        teamTotalHomeOdds: {},
        teamTotalAwayOdds: {},
        cleanSheetHomeOdds: null,
        cleanSheetAwayOdds: null,
        winToNilHomeOdds: null,
        winToNilAwayOdds: null,
        winEitherHalfOdds: null,
        resultTotalGoalsOdds: {},
        resultBttsOdds: {},
      },
      offeredBy: {
        home: best.bookmaker,
        draw: best.bookmaker,
        away: best.bookmaker,
      },
    };
  }

  // Latest complete 1X2 line per bookmaker (excluding synthetic aggregates).
  // Feeds the model↔market coherence gate's median implied probability.
  async findLatestOneXTwoOddsPerBookmaker(fixtureId: string): Promise<
    {
      bookmaker: string;
      homeOdds: Decimal;
      drawOdds: Decimal;
      awayOdds: Decimal;
    }[]
  > {
    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId,
        market: Market.ONE_X_TWO,
        bookmaker: { notIn: ['MarketAvg', 'MarketBest'] },
        homeOdds: { not: null },
        drawOdds: { not: null },
        awayOdds: { not: null },
      },
      select: {
        bookmaker: true,
        snapshotAt: true,
        homeOdds: true,
        drawOdds: true,
        awayOdds: true,
      },
      orderBy: [{ snapshotAt: 'desc' }, { bookmaker: 'asc' }],
    });

    const latestByBookmaker = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latestByBookmaker.has(row.bookmaker)) {
        latestByBookmaker.set(row.bookmaker, row);
      }
    }

    return Array.from(latestByBookmaker.values()).flatMap((row) => {
      if (
        row.homeOdds === null ||
        row.drawOdds === null ||
        row.awayOdds === null
      ) {
        return [];
      }
      return [
        {
          bookmaker: row.bookmaker,
          homeOdds: new Decimal(row.homeOdds.toString()),
          drawOdds: new Decimal(row.drawOdds.toString()),
          awayOdds: new Decimal(row.awayOdds.toString()),
        },
      ];
    });
  }

  // Latest OVER_UNDER odds per bookmaker, resolved PER PICK (not per market —
  // see resolvePerPickOddsPerLine's comment) so a bookmaker's coverage gap on
  // one line doesn't drop its odds for lines it does quote. Feeds the O/U
  // model↔market coherence gate's per-line median implied probability
  // (audit 2026-08-13/15 — assessOverUnderMarketCoherence in
  // market-coherence.ts).
  async findLatestOverUnderOddsPerBookmaker(
    fixtureId: string,
  ): Promise<{ bookmaker: string; odds: FullOddsSnapshot['overUnderOdds'] }[]> {
    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId,
        market: Market.OVER_UNDER,
        odds: { not: null },
      },
      select: { bookmaker: true, pick: true, odds: true, snapshotAt: true },
    });

    const latestByBookmakerPick = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!row.pick) continue;
      const key = `${row.bookmaker}::${row.pick}`;
      const current = latestByBookmakerPick.get(key);
      if (!current || row.snapshotAt.getTime() > current.snapshotAt.getTime()) {
        latestByBookmakerPick.set(key, row);
      }
    }

    const oddsByBookmaker = new Map<
      string,
      FullOddsSnapshot['overUnderOdds']
    >();
    for (const row of latestByBookmakerPick.values()) {
      if (!row.pick || !row.odds) continue;
      if (!(OVER_UNDER_PICKS as readonly string[]).includes(row.pick)) continue;
      const odds =
        oddsByBookmaker.get(row.bookmaker) ??
        ({} as FullOddsSnapshot['overUnderOdds']);
      odds[row.pick as keyof FullOddsSnapshot['overUnderOdds']] = new Decimal(
        row.odds.toString(),
      );
      oddsByBookmaker.set(row.bookmaker, odds);
    }

    return Array.from(oddsByBookmaker.entries()).map(([bookmaker, odds]) => ({
      bookmaker,
      odds,
    }));
  }
}
