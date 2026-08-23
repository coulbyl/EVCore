import { describe, it, expect, vi } from 'vitest';
import { Market } from '@evcore/db';
import { OddsSnapshotLoader } from './odds-snapshot.loader';
import type { PrismaService } from '@/prisma.service';

// findLatestOddsSnapshotsBatch is new, purely additive code (findLatestOddsSnapshot
// itself is untouched — its existing per-market bookmaker-resolution behaviour is
// already covered by betting-engine.service.spec.ts). These tests exercise the
// batch path directly: bookmaker preference, the ONE_X_TWO-only cutoff filter,
// and per-market OVER_UNDER odds parsing, across multiple fixtures at once.

function makeBatchLoader(rows: unknown[]): {
  loader: OddsSnapshotLoader;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(rows);
  const prismaMock = {
    client: { oddsSnapshot: { findMany } },
  } as unknown as PrismaService;
  return { loader: new OddsSnapshotLoader(prismaMock), findMany };
}

const CUTOFF = new Date('2026-08-09T12:00:00.000Z');

function oneXTwoRow(input: {
  fixtureId: string;
  bookmaker: string;
  snapshotAt: Date;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
}) {
  return {
    fixtureId: input.fixtureId,
    bookmaker: input.bookmaker,
    market: Market.ONE_X_TWO,
    pick: null,
    odds: null,
    snapshotAt: input.snapshotAt,
    homeOdds: input.homeOdds,
    drawOdds: input.drawOdds,
    awayOdds: input.awayOdds,
  };
}

function pickRow(input: {
  fixtureId: string;
  bookmaker: string;
  market: Market;
  pick: string;
  odds: number;
  snapshotAt: Date;
}) {
  return {
    fixtureId: input.fixtureId,
    bookmaker: input.bookmaker,
    market: input.market,
    pick: input.pick,
    odds: input.odds,
    snapshotAt: input.snapshotAt,
    homeOdds: null,
    drawOdds: null,
    awayOdds: null,
  };
}

describe('OddsSnapshotLoader.findLatestOddsSnapshotsBatch', () => {
  it('returns an empty map without querying when given no requests', async () => {
    const { loader, findMany } = makeBatchLoader([]);
    const result = await loader.findLatestOddsSnapshotsBatch([]);
    expect(result.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('resolves each fixture independently in a single query, null for fixtures with no rows', async () => {
    const snapshotAt = new Date('2026-08-09T08:00:00.000Z');
    const { loader, findMany } = makeBatchLoader([
      oneXTwoRow({
        fixtureId: 'f1',
        bookmaker: 'Bet365',
        snapshotAt,
        homeOdds: 1.9,
        drawOdds: 3.3,
        awayOdds: 4.0,
      }),
      oneXTwoRow({
        fixtureId: 'f1',
        bookmaker: 'Pinnacle',
        snapshotAt,
        homeOdds: 1.85,
        drawOdds: 3.35,
        awayOdds: 4.1,
      }),
      pickRow({
        fixtureId: 'f1',
        bookmaker: 'Pinnacle',
        market: Market.OVER_UNDER,
        pick: 'OVER',
        odds: 1.95,
        snapshotAt,
      }),
      oneXTwoRow({
        fixtureId: 'f2',
        bookmaker: 'Bet365',
        snapshotAt,
        homeOdds: 2.1,
        drawOdds: 3.1,
        awayOdds: 3.5,
      }),
    ]);

    const results = await loader.findLatestOddsSnapshotsBatch([
      { fixtureId: 'f1', cutoff: CUTOFF },
      { fixtureId: 'f2', cutoff: CUTOFF },
      { fixtureId: 'f3', cutoff: CUTOFF }, // no rows at all
    ]);

    expect(findMany).toHaveBeenCalledTimes(1);
    // f1 has both Bet365 and Pinnacle at the same snapshot — Pinnacle wins.
    expect(results.get('f1')?.bookmaker).toBe('Pinnacle');
    expect(results.get('f1')?.homeOdds.toNumber()).toBe(1.85);
    expect(results.get('f1')?.overUnderOdds.OVER?.toNumber()).toBe(1.95);
    // f2 only has Bet365.
    expect(results.get('f2')?.bookmaker).toBe('Bet365');
    // f3 has no rows at all.
    expect(results.get('f3')).toBeNull();
  });

  it('resolves each OVER_UNDER line independently instead of picking one bookmaker for the whole market', async () => {
    // Regression test for the 2026-08-13 audit finding: a bookmaker that only
    // quotes the 3.5/4.5 lines at the latest snapshot must not make the 2.5
    // line (quoted earlier by a different bookmaker) disappear from
    // evaluatedPicks.
    const earlier = new Date('2026-08-09T06:00:00.000Z');
    const latest = new Date('2026-08-09T08:00:00.000Z');
    const { loader } = makeBatchLoader([
      oneXTwoRow({
        fixtureId: 'f1',
        bookmaker: 'Bet365',
        snapshotAt: latest,
        homeOdds: 1.9,
        drawOdds: 3.3,
        awayOdds: 4.0,
      }),
      // Bet365 is the market-wide "best bookmaker" (latest snapshot, highest
      // rank) but only quotes the 3.5/4.5 lines at that snapshot.
      pickRow({
        fixtureId: 'f1',
        bookmaker: 'Bet365',
        market: Market.OVER_UNDER,
        pick: 'OVER_3_5',
        odds: 2.5,
        snapshotAt: latest,
      }),
      pickRow({
        fixtureId: 'f1',
        bookmaker: 'Bet365',
        market: Market.OVER_UNDER,
        pick: 'UNDER_3_5',
        odds: 1.55,
        snapshotAt: latest,
      }),
      // Unibet only quotes the 2.5 line, and only at an earlier snapshot.
      pickRow({
        fixtureId: 'f1',
        bookmaker: 'Unibet',
        market: Market.OVER_UNDER,
        pick: 'OVER',
        odds: 1.28,
        snapshotAt: earlier,
      }),
      pickRow({
        fixtureId: 'f1',
        bookmaker: 'Unibet',
        market: Market.OVER_UNDER,
        pick: 'UNDER',
        odds: 3.4,
        snapshotAt: earlier,
      }),
    ]);

    const results = await loader.findLatestOddsSnapshotsBatch([
      { fixtureId: 'f1', cutoff: CUTOFF },
    ]);

    const overUnderOdds = results.get('f1')?.overUnderOdds;
    expect(overUnderOdds?.OVER_3_5?.toNumber()).toBe(2.5);
    expect(overUnderOdds?.UNDER_3_5?.toNumber()).toBe(1.55);
    // The 2.5 line must still be present, sourced from Unibet.
    expect(overUnderOdds?.OVER?.toNumber()).toBe(1.28);
    expect(overUnderOdds?.UNDER?.toNumber()).toBe(3.4);
  });

  it('applies the cutoff to ONE_X_TWO rows per fixture', async () => {
    const { loader } = makeBatchLoader([
      oneXTwoRow({
        fixtureId: 'f1',
        bookmaker: 'Pinnacle',
        snapshotAt: new Date('2026-08-10T00:00:00.000Z'), // after cutoff
        homeOdds: 1.8,
        drawOdds: 3.4,
        awayOdds: 4.2,
      }),
    ]);

    const results = await loader.findLatestOddsSnapshotsBatch([
      { fixtureId: 'f1', cutoff: CUTOFF },
    ]);

    expect(results.get('f1')).toBeNull();
  });

  it('applies the cutoff to non-ONE_X_TWO markets too (regression, 2026-08-17 point-in-time audit)', async () => {
    // Before the fix, pickBestBookmaker/rowsForMarketBookmaker/
    // resolvePerPickOddsPerLine ignored `cutoff` entirely for every market
    // except ONE_X_TWO — a backtest or the live line-movement filter
    // (cutoff7d in analyzeFixture) asking "what were the odds as of date X"
    // silently got the newest OVER_UNDER/BTTS/... price in the DB instead,
    // regardless of X. This pins the fix: a price recorded after cutoff must
    // never be visible.
    const beforeCutoff = new Date('2026-08-09T06:00:00.000Z');
    const afterCutoff = new Date('2026-08-10T00:00:00.000Z'); // after CUTOFF
    const { loader } = makeBatchLoader([
      oneXTwoRow({
        fixtureId: 'f1',
        bookmaker: 'Bet365',
        snapshotAt: beforeCutoff,
        homeOdds: 1.9,
        drawOdds: 3.3,
        awayOdds: 4.0,
      }),
      // Only quote available for OVER/UNDER is dated after cutoff.
      pickRow({
        fixtureId: 'f1',
        bookmaker: 'Bet365',
        market: Market.OVER_UNDER,
        pick: 'OVER',
        odds: 1.9,
        snapshotAt: afterCutoff,
      }),
      pickRow({
        fixtureId: 'f1',
        bookmaker: 'Bet365',
        market: Market.OVER_UNDER,
        pick: 'UNDER',
        odds: 1.95,
        snapshotAt: afterCutoff,
      }),
      // BTTS resolved through the "one bookmaker for the whole market" path
      // (pickBestBookmaker/rowsForMarketBookmaker) — same bug, same fix.
      pickRow({
        fixtureId: 'f1',
        bookmaker: 'Bet365',
        market: Market.BTTS,
        pick: 'YES',
        odds: 1.8,
        snapshotAt: afterCutoff,
      }),
    ]);

    const results = await loader.findLatestOddsSnapshotsBatch([
      { fixtureId: 'f1', cutoff: CUTOFF },
    ]);

    const snapshot = results.get('f1');
    expect(snapshot?.overUnderOdds.OVER).toBeUndefined();
    expect(snapshot?.overUnderOdds.UNDER).toBeUndefined();
    expect(snapshot?.bttsYesOdds).toBeNull();
  });

  it('resolves TEAM_TOTAL_HOME per line too — the OVER_UNDER fix generalizes to every sparse-pick market', async () => {
    // Same shape as the OVER_UNDER regression above, generalized (audit
    // 2026-08-13 "reste ouvert"): TEAM_TOTAL_HOME/AWAY, RESULT_TOTAL_GOALS,
    // RESULT_BTTS, CORRECT_SCORE and OVER_UNDER_HT all had the same
    // market-wide bookmaker bug, just never confirmed by a live incident the
    // way OVER_UNDER was.
    const earlier = new Date('2026-08-09T06:00:00.000Z');
    const latest = new Date('2026-08-09T08:00:00.000Z');
    const { loader } = makeBatchLoader([
      oneXTwoRow({
        fixtureId: 'f1',
        bookmaker: 'Bet365',
        snapshotAt: latest,
        homeOdds: 1.9,
        drawOdds: 3.3,
        awayOdds: 4.0,
      }),
      pickRow({
        fixtureId: 'f1',
        bookmaker: 'Bet365',
        market: Market.TEAM_TOTAL_HOME,
        pick: 'OVER_2_5',
        odds: 2.2,
        snapshotAt: latest,
      }),
      // Unibet only quotes the 1.5 line, at an earlier snapshot — must not
      // be dropped just because Bet365 is the market-wide latest bookmaker.
      pickRow({
        fixtureId: 'f1',
        bookmaker: 'Unibet',
        market: Market.TEAM_TOTAL_HOME,
        pick: 'OVER_1_5',
        odds: 1.5,
        snapshotAt: earlier,
      }),
    ]);

    const results = await loader.findLatestOddsSnapshotsBatch([
      { fixtureId: 'f1', cutoff: CUTOFF },
    ]);

    expect(results.get('f1')?.teamTotalHomeOdds.OVER_2_5?.toNumber()).toBe(2.2);
    expect(results.get('f1')?.teamTotalHomeOdds.OVER_1_5?.toNumber()).toBe(1.5);
  });
});

describe('OddsSnapshotLoader.findLatestOddsSnapshot — TEAM_TOTAL_HOME per-line resolution (single-fixture path)', () => {
  it('resolves TEAM_TOTAL_HOME per line instead of one bookmaker for the whole market', async () => {
    const earlier = new Date('2026-08-09T06:00:00.000Z');
    const latest = new Date('2026-08-09T08:00:00.000Z');

    const findMany = vi.fn((args: { where?: { market?: Market } }) => {
      const market = args.where?.market;
      if (market === Market.ONE_X_TWO) {
        return [
          {
            bookmaker: 'Bet365',
            snapshotAt: latest,
            homeOdds: 1.9,
            drawOdds: 3.3,
            awayOdds: 4.0,
          },
        ];
      }
      if (market === Market.TEAM_TOTAL_HOME) {
        return [
          {
            bookmaker: 'Bet365',
            pick: 'OVER_2_5',
            odds: 2.2,
            snapshotAt: latest,
          },
          {
            bookmaker: 'Unibet',
            pick: 'OVER_1_5',
            odds: 1.5,
            snapshotAt: earlier,
          },
        ];
      }
      return [];
    });
    const prismaMock = {
      client: {
        oddsSnapshot: { findMany, findFirst: vi.fn().mockResolvedValue(null) },
      },
    } as unknown as PrismaService;

    const loader = new OddsSnapshotLoader(prismaMock);
    const snapshot = await loader.findLatestOddsSnapshot('f1', CUTOFF);

    expect(snapshot?.teamTotalHomeOdds.OVER_2_5?.toNumber()).toBe(2.2);
    expect(snapshot?.teamTotalHomeOdds.OVER_1_5?.toNumber()).toBe(1.5);
  });
});

describe('OddsSnapshotLoader.findLatestBestOneXTwoOddsSnapshot', () => {
  it('returns one real bookmaker triplet instead of fabricating a mix of each side’s best price', () => {
    // Regression for the 2026-08-13 audit finding: the old algorithm picked
    // the highest home odds, highest draw odds and highest away odds
    // independently across bookmakers and labeled the result "MarketBest" —
    // a triplet no real bookmaker ever offered, with an overround lower than
    // any single book's, which inflated every EV computed against it in the
    // FRI channel. Bookmaker B has the single best (lowest) overround here
    // even though A has a higher home price and C a higher away price —
    // the fix must return B's real triplet, not a mix of A/B/C.
    const snapshotAt = new Date('2026-08-09T08:00:00.000Z');
    const { loader } = makeBatchLoader([
      {
        bookmaker: 'A',
        snapshotAt,
        homeOdds: 2.1,
        drawOdds: 3.0,
        awayOdds: 3.2,
      },
      {
        bookmaker: 'B',
        snapshotAt,
        homeOdds: 2.0,
        drawOdds: 3.4,
        awayOdds: 3.4,
      },
      {
        bookmaker: 'C',
        snapshotAt,
        homeOdds: 1.95,
        drawOdds: 3.1,
        awayOdds: 3.6,
      },
    ]);

    return loader
      .findLatestBestOneXTwoOddsSnapshot('f1', CUTOFF)
      .then((result) => {
        expect(result?.snapshot.bookmaker).toBe('B');
        expect(result?.snapshot.homeOdds.toNumber()).toBe(2.0);
        expect(result?.snapshot.drawOdds.toNumber()).toBe(3.4);
        expect(result?.snapshot.awayOdds.toNumber()).toBe(3.4);
        expect(result?.offeredBy).toEqual({
          home: 'B',
          draw: 'B',
          away: 'B',
        });
      });
  });

  it('returns null when no bookmaker has a complete triplet', () => {
    const { loader } = makeBatchLoader([]);
    return loader
      .findLatestBestOneXTwoOddsSnapshot('f1', CUTOFF)
      .then((result) => {
        expect(result).toBeNull();
      });
  });
});

describe('OddsSnapshotLoader.findLatestOddsSnapshot — OVER_UNDER per-line resolution', () => {
  it('resolves each OVER_UNDER line independently instead of picking one bookmaker for the whole market (single-fixture path)', async () => {
    // Same regression as the batch-path test above, but for the
    // non-batched query path (findBestBookmakerForMarket used to be reused
    // for OVER_UNDER too, reproducing the market-wide bug there as well).
    const earlier = new Date('2026-08-09T06:00:00.000Z');
    const latest = new Date('2026-08-09T08:00:00.000Z');

    const findMany = vi.fn((args: { where?: { market?: Market } }) => {
      const market = args.where?.market;
      if (market === Market.ONE_X_TWO) {
        return [
          {
            bookmaker: 'Bet365',
            snapshotAt: latest,
            homeOdds: 1.9,
            drawOdds: 3.3,
            awayOdds: 4.0,
          },
        ];
      }
      if (market === Market.OVER_UNDER) {
        return [
          {
            bookmaker: 'Bet365',
            pick: 'OVER_3_5',
            odds: 2.5,
            snapshotAt: latest,
          },
          {
            bookmaker: 'Bet365',
            pick: 'UNDER_3_5',
            odds: 1.55,
            snapshotAt: latest,
          },
          {
            bookmaker: 'Unibet',
            pick: 'OVER',
            odds: 1.28,
            snapshotAt: earlier,
          },
          {
            bookmaker: 'Unibet',
            pick: 'UNDER',
            odds: 3.4,
            snapshotAt: earlier,
          },
        ];
      }
      return [];
    });
    const prismaMock = {
      client: {
        oddsSnapshot: { findMany, findFirst: vi.fn().mockResolvedValue(null) },
      },
    } as unknown as PrismaService;

    const loader = new OddsSnapshotLoader(prismaMock);
    const snapshot = await loader.findLatestOddsSnapshot('f1', CUTOFF);

    expect(snapshot?.overUnderOdds.OVER_3_5?.toNumber()).toBe(2.5);
    expect(snapshot?.overUnderOdds.UNDER_3_5?.toNumber()).toBe(1.55);
    // The 2.5 line, quoted only by Unibet at an earlier snapshot, must
    // survive instead of being dropped in favor of Bet365 (the market-wide
    // latest/highest-rank bookmaker, which never quoted this line).
    expect(snapshot?.overUnderOdds.OVER?.toNumber()).toBe(1.28);
    expect(snapshot?.overUnderOdds.UNDER?.toNumber()).toBe(3.4);
  });
});

describe('OddsSnapshotLoader.findLatestOverUnderOddsPerBookmaker', () => {
  it('resolves each bookmaker’s odds per line independently, not per market', async () => {
    // Feeds the OVER_UNDER calibration_alert gate — a bookmaker's latest
    // snapshot for one line must not hide odds it quoted for another line
    // at an earlier time (same fix as the OVER_UNDER per-line resolution
    // bug, applied to the per-bookmaker accessor).
    const earlier = new Date('2026-08-09T06:00:00.000Z');
    const latest = new Date('2026-08-09T08:00:00.000Z');
    const findMany = vi.fn().mockResolvedValue([
      {
        bookmaker: 'Bet365',
        pick: 'OVER_3_5',
        odds: 2.5,
        snapshotAt: latest,
      },
      {
        bookmaker: 'Bet365',
        pick: 'UNDER_3_5',
        odds: 1.55,
        snapshotAt: latest,
      },
      { bookmaker: 'Bet365', pick: 'OVER', odds: 1.9, snapshotAt: earlier },
      { bookmaker: 'Bet365', pick: 'UNDER', odds: 1.9, snapshotAt: earlier },
      { bookmaker: 'Unibet', pick: 'OVER', odds: 1.85, snapshotAt: latest },
      { bookmaker: 'Unibet', pick: 'UNDER', odds: 1.95, snapshotAt: latest },
    ]);
    const prismaMock = {
      client: { oddsSnapshot: { findMany } },
    } as unknown as PrismaService;

    const loader = new OddsSnapshotLoader(prismaMock);
    const books = await loader.findLatestOverUnderOddsPerBookmaker('f1');

    const bet365 = books.find((b) => b.bookmaker === 'Bet365');
    expect(bet365?.odds.OVER_3_5?.toNumber()).toBe(2.5);
    expect(bet365?.odds.UNDER_3_5?.toNumber()).toBe(1.55);
    // Bet365's 2.5-line quote from earlier must still be present.
    expect(bet365?.odds.OVER?.toNumber()).toBe(1.9);
    expect(bet365?.odds.UNDER?.toNumber()).toBe(1.9);

    const unibet = books.find((b) => b.bookmaker === 'Unibet');
    expect(unibet?.odds.OVER?.toNumber()).toBe(1.85);
    expect(unibet?.odds.UNDER?.toNumber()).toBe(1.95);
  });
});
