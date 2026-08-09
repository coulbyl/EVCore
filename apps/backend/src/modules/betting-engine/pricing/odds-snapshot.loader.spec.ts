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
});
