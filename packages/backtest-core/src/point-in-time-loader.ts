import type { FullOddsSnapshot } from "@evcore/analysis-core";
import { assembleFullOddsSnapshot } from "@evcore/analysis-core";
import { prisma, FixtureStatus, type PrismaClient } from "@evcore/db";

// The structural fix behind docs/backtest-harness-architecture.md: instead
// of trusting every backtest script to remember "don't read the future",
// every historical read in this package goes through this loader, and every
// query here is bounded by `asOf` — the instant being replayed, not "now".
// architecture.guard.spec.ts enforces that no other file in this package
// touches @evcore/db directly, so this is the only place that CAN leak a
// future row if it's ever wrong — one place to get right, one place to test.
//
// `asOf` means "as the information was known at this instant", not just
// "the fixture's kickoff is before this instant" — an odds snapshot, a
// rolling stat, an Elo rating are each filtered by their OWN recorded
// timestamp, never by the fixture's scheduledAt alone. See
// docs/backtest-harness-architecture.md §5.

export type PointInTimeContext = {
  readonly asOf: Date;
};

// A finished fixture with a known result — the unit the replay engine walks
// chronologically. Ground truth (homeScore/awayScore) only exists once the
// fixture is FINISHED, which is itself a point-in-time fact: listing only
// FINISHED fixtures with a non-null score is as much a part of the
// point-in-time guarantee as filtering odds by `asOf`.
export type ReplayFixture = {
  id: string;
  scheduledAt: Date;
  competitionCode: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

export type ListFixturesOptions = {
  from: Date;
  to: Date;
  // Defaults to every Competition with includeInBacktest=true (the same
  // flag the rest of the codebase already uses to exclude thin/noisy
  // competitions from backtests).
  competitionCodes?: readonly string[];
};

export class PointInTimeLoader {
  constructor(private readonly client: PrismaClient = prisma) {}

  // Chronologically ordered, finished fixtures with a settled score — the
  // replay universe. Never returns SCHEDULED/IN_PROGRESS/POSTPONED/CANCELLED
  // fixtures: a backtest replays what happened, not what's still pending.
  async listFixtures(options: ListFixturesOptions): Promise<ReplayFixture[]> {
    const rows = await this.client.fixture.findMany({
      where: {
        scheduledAt: { gte: options.from, lte: options.to },
        status: FixtureStatus.FINISHED,
        homeScore: { not: null },
        awayScore: { not: null },
        season: {
          competition: {
            includeInBacktest: true,
            ...(options.competitionCodes
              ? { code: { in: [...options.competitionCodes] } }
              : {}),
          },
        },
      },
      select: {
        id: true,
        scheduledAt: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
        season: { select: { competition: { select: { code: true } } } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    return rows.map((row) => ({
      id: row.id,
      scheduledAt: row.scheduledAt,
      competitionCode: row.season.competition.code,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      // Non-null guaranteed by the where clause above.
      homeScore: row.homeScore!,
      awayScore: row.awayScore!,
    }));
  }

  // Cotes telles qu'elles existaient à `asOf`, tous marchés — réutilise
  // assembleFullOddsSnapshot d'@evcore/analysis-core, la même fonction pure
  // qui sert la prod (OddsSnapshotLoader). Un seul calcul, deux appelants.
  async loadOdds(
    fixtureId: string,
    context: PointInTimeContext,
  ): Promise<FullOddsSnapshot | null> {
    const rows = await this.client.oddsSnapshot.findMany({
      where: { fixtureId },
      select: {
        bookmaker: true,
        market: true,
        pick: true,
        odds: true,
        snapshotAt: true,
        homeOdds: true,
        drawOdds: true,
        awayOdds: true,
      },
    });
    return assembleFullOddsSnapshot(rows, context.asOf);
  }

  // Batched counterpart — one query for every fixture instead of one per
  // fixture, same shape as OddsSnapshotLoader.findLatestOddsSnapshotsBatch.
  // Each fixture keeps its own `asOf` (a replay walking forward through a
  // season needs a different cutoff per fixture, not one shared cutoff).
  async loadOddsBatch(
    requests: ReadonlyArray<{ fixtureId: string; asOf: Date }>,
  ): Promise<Map<string, FullOddsSnapshot | null>> {
    const result = new Map<string, FullOddsSnapshot | null>();
    if (requests.length === 0) return result;

    const rows = await this.client.oddsSnapshot.findMany({
      where: { fixtureId: { in: requests.map((r) => r.fixtureId) } },
      select: {
        fixtureId: true,
        bookmaker: true,
        market: true,
        pick: true,
        odds: true,
        snapshotAt: true,
        homeOdds: true,
        drawOdds: true,
        awayOdds: true,
      },
    });

    const rowsByFixture = new Map<string, typeof rows>();
    for (const row of rows) {
      const bucket = rowsByFixture.get(row.fixtureId);
      if (bucket) bucket.push(row);
      else rowsByFixture.set(row.fixtureId, [row]);
    }

    for (const { fixtureId, asOf } of requests) {
      result.set(
        fixtureId,
        assembleFullOddsSnapshot(rowsByFixture.get(fixtureId) ?? [], asOf),
      );
    }
    return result;
  }
}
