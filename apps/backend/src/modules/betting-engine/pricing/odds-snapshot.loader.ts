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

function parseTeamTotalRows(
  rows: { pick: string | null; odds: Prisma.Decimal | null }[] | null,
): FullOddsSnapshot['teamTotalHomeOdds'] {
  const odds: FullOddsSnapshot['teamTotalHomeOdds'] = {};
  for (const row of rows ?? []) {
    if (!row.pick || !row.odds) continue;
    if (
      !(row.pick in odds) &&
      (TEAM_TOTAL_PICKS as readonly string[]).includes(row.pick)
    ) {
      odds[row.pick as (typeof TEAM_TOTAL_PICKS)[number]] = new Decimal(
        row.odds.toString(),
      );
    }
  }
  return odds;
}

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
    // OVER_UNDER while Bet365 may not).
    const [
      ouBookmaker,
      bttsBookmaker,
      htftBookmaker,
      ouHtBookmaker,
      fhwBookmaker,
      dcBookmaker,
      csBookmaker,
      dnbBookmaker,
      ttHomeBookmaker,
      ttAwayBookmaker,
    ] = await Promise.all([
      this.findBestBookmakerForMarket(fixtureId, Market.OVER_UNDER, cutoff),
      this.findBestBookmakerForMarket(fixtureId, Market.BTTS, cutoff),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.HALF_TIME_FULL_TIME,
        cutoff,
      ),
      this.findBestBookmakerForMarket(fixtureId, Market.OVER_UNDER_HT, cutoff),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.FIRST_HALF_WINNER,
        cutoff,
      ),
      this.findBestBookmakerForMarket(fixtureId, Market.DOUBLE_CHANCE, cutoff),
      this.findBestBookmakerForMarket(fixtureId, Market.CORRECT_SCORE, cutoff),
      this.findBestBookmakerForMarket(fixtureId, Market.DRAW_NO_BET, cutoff),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.TEAM_TOTAL_HOME,
        cutoff,
      ),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.TEAM_TOTAL_AWAY,
        cutoff,
      ),
    ]);

    const [
      ouRows,
      bttsYesRow,
      bttsNoRow,
      htftRows,
      ouHtRows,
      fhwRows,
      dcRows,
      csRows,
      dnbRows,
      ttHomeRows,
      ttAwayRows,
    ] = await Promise.all([
      ouBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: ouBookmaker,
              market: Market.OVER_UNDER,
            },
            select: { pick: true, odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
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
      ouHtBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: ouHtBookmaker,
              market: Market.OVER_UNDER_HT,
            },
            select: { pick: true, odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
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
      csBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: csBookmaker,
              market: Market.CORRECT_SCORE,
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
      ttHomeBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: ttHomeBookmaker,
              market: Market.TEAM_TOTAL_HOME,
            },
            select: { pick: true, odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
      ttAwayBookmaker
        ? this.prisma.client.oddsSnapshot.findMany({
            where: {
              fixtureId,
              bookmaker: ttAwayBookmaker,
              market: Market.TEAM_TOTAL_AWAY,
            },
            select: { pick: true, odds: true },
            orderBy: { snapshotAt: 'desc' },
          })
        : null,
    ]);

    const htftOdds = {} as Partial<Record<HalfTimeFullTimePick, Decimal>>;
    const overUnderOdds = {} as FullOddsSnapshot['overUnderOdds'];
    const ouHtOdds = {} as FullOddsSnapshot['ouHtOdds'];
    let firstHalfWinnerOdds: FullOddsSnapshot['firstHalfWinnerOdds'] = null;
    let doubleChanceOdds: FullOddsSnapshot['doubleChanceOdds'] = null;

    for (const row of ouRows ?? []) {
      if (!row.pick || !row.odds) continue;
      if (
        !(row.pick in overUnderOdds) &&
        (row.pick === 'OVER_1_5' ||
          row.pick === 'UNDER_1_5' ||
          row.pick === 'OVER' ||
          row.pick === 'UNDER' ||
          row.pick === 'OVER_3_5' ||
          row.pick === 'UNDER_3_5' ||
          row.pick === 'OVER_4_5' ||
          row.pick === 'UNDER_4_5')
      ) {
        overUnderOdds[row.pick] = new Decimal(row.odds.toString());
      }
    }
    for (const row of htftRows) {
      if (!row.pick || !row.odds) continue;
      if (!(row.pick in htftOdds) && isHalfTimeFullTimePick(row.pick)) {
        htftOdds[row.pick] = new Decimal(row.odds.toString());
      }
    }
    for (const row of ouHtRows ?? []) {
      if (!row.pick || !row.odds) continue;
      if (
        !(row.pick in ouHtOdds) &&
        (row.pick === 'OVER_0_5' ||
          row.pick === 'UNDER_0_5' ||
          row.pick === 'OVER_1_5' ||
          row.pick === 'UNDER_1_5')
      ) {
        ouHtOdds[row.pick] = new Decimal(row.odds.toString());
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

    const teamTotalHomeOdds = parseTeamTotalRows(ttHomeRows);
    const teamTotalAwayOdds = parseTeamTotalRows(ttAwayRows);

    const correctScoreOdds: Partial<Record<string, Decimal>> = {};
    for (const row of csRows ?? []) {
      if (!row.pick || !row.odds) continue;
      if (!(row.pick in correctScoreOdds)) {
        correctScoreOdds[row.pick] = new Decimal(row.odds.toString());
      }
    }

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
    };
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
    };
  }

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

    const bestHome = latestRows.reduce(
      (best, row) =>
        best === null ||
        new Decimal(row.homeOdds!.toString()).greaterThan(
          new Decimal(best.homeOdds!.toString()),
        )
          ? row
          : best,
      null as (typeof latestRows)[number] | null,
    );
    const bestDraw = latestRows.reduce(
      (best, row) =>
        best === null ||
        new Decimal(row.drawOdds!.toString()).greaterThan(
          new Decimal(best.drawOdds!.toString()),
        )
          ? row
          : best,
      null as (typeof latestRows)[number] | null,
    );
    const bestAway = latestRows.reduce(
      (best, row) =>
        best === null ||
        new Decimal(row.awayOdds!.toString()).greaterThan(
          new Decimal(best.awayOdds!.toString()),
        )
          ? row
          : best,
      null as (typeof latestRows)[number] | null,
    );

    if (bestHome === null || bestDraw === null || bestAway === null) {
      return null;
    }

    return {
      snapshot: {
        bookmaker: 'MarketBest',
        snapshotAt: latestRows[0].snapshotAt,
        homeOdds: new Decimal(bestHome.homeOdds!.toString()),
        drawOdds: new Decimal(bestDraw.drawOdds!.toString()),
        awayOdds: new Decimal(bestAway.awayOdds!.toString()),
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
      },
      offeredBy: {
        home: bestHome.bookmaker,
        draw: bestDraw.bookmaker,
        away: bestAway.bookmaker,
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
}
