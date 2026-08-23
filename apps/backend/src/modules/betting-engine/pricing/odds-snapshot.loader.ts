import { Injectable } from '@nestjs/common';
import { Market, Prisma } from '@evcore/db';
import Decimal from 'decimal.js';
import {
  assembleFullOddsSnapshot,
  bookmakerRank,
  parseYesNoRows,
  parseHomeAwayRows,
  OVER_UNDER_PICKS,
  OU_HT_PICKS,
  TEAM_TOTAL_PICKS,
  RESULT_TOTAL_GOALS_PICKS,
  RESULT_BTTS_PICKS,
  type RawOddsRow,
} from '@evcore/analysis-core';
import { PrismaService } from '@/prisma.service';
import { isHalfTimeFullTimePick } from '../betting-engine.utils';
import type { HalfTimeFullTimePick } from '../betting-engine.utils';
import type { FullOddsSnapshot } from '../betting-engine.types';

// Odds-resolution logic (bookmaker preference, per-pick sparse-market
// resolution, cutoff enforcement, assembleFullOddsSnapshot) now lives in
// @evcore/analysis-core (extracted 2026-08-17 — see
// docs/backtest-harness-architecture.md) so the backtest harness reuses the
// exact same implementation instead of a second, driftable copy. This file
// keeps only the Prisma I/O: fetching rows and calling the shared pure
// assembly function.

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
    cutoff: Date,
  ): Promise<string | null> {
    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId,
        market,
        odds: { not: null },
        snapshotAt: { lte: cutoff },
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
    opts: { cutoff: Date; validKeys?: readonly T[] },
  ): Promise<Partial<Record<T, Decimal>>> {
    const { cutoff, validKeys } = opts;
    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId,
        market,
        odds: { not: null },
        snapshotAt: { lte: cutoff },
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
      this.findPerPickOddsPerLine(fixtureId, Market.OVER_UNDER, {
        cutoff,
        validKeys: OVER_UNDER_PICKS,
      }),
      this.findPerPickOddsPerLine(fixtureId, Market.OVER_UNDER_HT, {
        cutoff,
        validKeys: OU_HT_PICKS,
      }),
      this.findPerPickOddsPerLine(fixtureId, Market.TEAM_TOTAL_HOME, {
        cutoff,
        validKeys: TEAM_TOTAL_PICKS,
      }),
      this.findPerPickOddsPerLine(fixtureId, Market.TEAM_TOTAL_AWAY, {
        cutoff,
        validKeys: TEAM_TOTAL_PICKS,
      }),
      this.findPerPickOddsPerLine(fixtureId, Market.RESULT_TOTAL_GOALS, {
        cutoff,
        validKeys: RESULT_TOTAL_GOALS_PICKS,
      }),
      this.findPerPickOddsPerLine(fixtureId, Market.RESULT_BTTS, {
        cutoff,
        validKeys: RESULT_BTTS_PICKS,
      }),
      this.findPerPickOddsPerLine<string>(fixtureId, Market.CORRECT_SCORE, {
        cutoff,
      }),
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
    cutoff: Date,
    bookmaker: string,
  ): Promise<FullOddsSnapshot | null> {
    const row = await this.prisma.client.oddsSnapshot.findFirst({
      where: {
        fixtureId,
        market: Market.ONE_X_TWO,
        bookmaker,
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
    cutoff: Date,
  ): Promise<{
    snapshot: FullOddsSnapshot;
    offeredBy: { home: string; draw: string; away: string };
  } | null> {
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
  /**
   * Meilleure cote disponible par (fixture, marché, pick), toutes maisons
   * confondues, au dernier instantané antérieur au coup d'envoi.
   *
   * DISTINCT de `findLatestOddsSnapshotsBatch`, qui résout la maison la mieux
   * CLASSÉE (`bookmakerRank` : Pinnacle d'abord, la plus juste) et non la
   * mieux PAYÉE. Les deux sont nécessaires et ne servent pas à la même chose :
   *
   *   - la maison la plus juste donne la référence de marché — `pMarketFair`,
   *     la marge, et la divergence modèle↔marché que `MAX_LEG_EDGE` plafonne.
   *     La remplacer par le meilleur prix ferait mécaniquement monter tous les
   *     edges d'environ 2% et relâcherait ce garde-fou sans qu'on le décide.
   *   - la mieux payée donne le prix auquel on mise réellement.
   *
   * Ce que ça vaut, mesuré sur 65 000 lignes multi-maisons (2026-08-22),
   * meilleure cote contre moyenne des maisons :
   *
   *   cote 1.20-1.50  n=15 516  +1.85%
   *   cote 1.50-2.00  n=16 880  +2.34%
   *   cote 2.00-2.50  n=13 496  +3.19%
   *   cote 2.50-4.00  n=19 005  +4.07%
   *
   * Sur la meilleure tranche de jambes, ça fait passer le ROI de -3.06% à
   * environ -1.27% — le plus gros levier mesuré, et le seul qui ne demande de
   * découvrir aucun signal.
   *
   * Clé de la map retournée : `${fixtureId}:${market}:${pick}`.
   */
  async findBestPricesBatch(
    targets: readonly { fixtureId: string; cutoff: Date }[],
  ): Promise<Map<string, number>> {
    if (targets.length === 0) return new Map();

    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        OR: targets.map(({ fixtureId, cutoff }) => ({
          fixtureId,
          snapshotAt: { lte: cutoff },
        })),
        odds: { not: null },
        pick: { not: null },
      },
      select: {
        fixtureId: true,
        market: true,
        pick: true,
        odds: true,
        snapshotAt: true,
      },
    });

    // Le maximum est pris au DERNIER instantané de chaque (fixture, marché,
    // pick) : comparer des prix relevés à des heures différentes reviendrait à
    // choisir le meilleur moment autant que la meilleure maison, ce qui n'est
    // pas jouable en pratique.
    const latestAt = new Map<string, number>();
    for (const r of rows) {
      if (!r.pick) continue;
      const key = `${r.fixtureId}:${r.market}:${r.pick}`;
      const ts = r.snapshotAt.getTime();
      const seen = latestAt.get(key);
      if (seen === undefined || ts > seen) latestAt.set(key, ts);
    }

    const best = new Map<string, number>();
    for (const r of rows) {
      if (!r.pick || r.odds === null) continue;
      const key = `${r.fixtureId}:${r.market}:${r.pick}`;
      if (r.snapshotAt.getTime() !== latestAt.get(key)) continue;
      const odds = Number(r.odds);
      const current = best.get(key);
      if (current === undefined || odds > current) best.set(key, odds);
    }
    return best;
  }
}
