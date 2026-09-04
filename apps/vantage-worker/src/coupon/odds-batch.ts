import { prisma } from "@evcore/db";
import { assembleFullOddsSnapshot, type RawOddsRow } from "@evcore/analysis-core";
import type { FullOddsSnapshot } from "@evcore/analysis-core";

// Mirrors apps/backend's OddsSnapshotLoader.findLatestOddsSnapshotsBatch/
// findBestPricesBatch (apps/backend/src/modules/betting-engine/pricing/
// odds-snapshot.loader.ts) — same two batched queries, same pure assembly
// (assembleFullOddsSnapshot, already in analysis-core), but reading
// `@evcore/db`'s `prisma` client directly instead of going through
// apps/backend's NestJS-injectable PrismaService/OddsSnapshotLoader. Needed
// so apps/vantage-worker can build its own coupon candidate pool without
// depending on apps/backend's NestJS layer (docs/vantage-centric-
// redesign-2026-09-01.md §9bis).

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

// One query for every fixture's odds instead of one per fixture — condition
// of viability once the pool spans more than a single day.
export async function findLatestOddsSnapshotsBatch(
  requests: ReadonlyArray<{ fixtureId: string; cutoff: Date }>,
): Promise<Map<string, FullOddsSnapshot | null>> {
  const result = new Map<string, FullOddsSnapshot | null>();
  if (requests.length === 0) return result;

  const rows = await prisma.oddsSnapshot.findMany({
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

// Best price available across every bookmaker for a (fixture, market, pick),
// as of each fixture's own cutoff — the stake price, distinct from the
// reference price findLatestOddsSnapshotsBatch resolves (best-ranked single
// bookmaker, used to measure model↔market divergence, never to stake). See
// coupon-pool.service.ts's own findBestPricesBatch doc for the measured ROI
// gain of staking at the best price instead of the reference one.
//
// Key of the returned map: `${fixtureId}:${market}:${pick}`.
export async function findBestPricesBatch(
  targets: ReadonlyArray<{ fixtureId: string; cutoff: Date }>,
): Promise<Map<string, number>> {
  if (targets.length === 0) return new Map();

  const rows = await prisma.oddsSnapshot.findMany({
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

  // The maximum is taken at the LATEST snapshot of each (fixture, market,
  // pick) — comparing prices read at different times would mean picking the
  // best moment as much as the best bookmaker, which isn't actionable.
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
