import type {
  FullOddsSnapshot,
  TeamStatsInput,
  H2HLeg,
  H2HMarketSignals,
  H2HScorelineSignal,
  TeamCongestionInputs,
} from "@evcore/analysis-core";
import {
  assembleFullOddsSnapshot,
  isEuropeanCompetition,
  isNationalTeamCompetition,
  resolveEffectiveTeamStats,
  DOMESTIC_SEASON_ROLLOVER_MIN_GAMES,
  computeH2HScoreFromLegs,
  computeH2HMarketSignalsFromLegs,
  computeH2HScorelineSignalFromLegs,
  H2H_LIMIT_DEFAULT,
  computeCongestionScoreFromTeams,
  CONGESTION_UPCOMING_WINDOW_MS,
} from "@evcore/analysis-core";
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
  seasonId: string;
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
        seasonId: true,
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
      seasonId: row.seasonId,
      scheduledAt: row.scheduledAt,
      competitionCode: row.season.competition.code,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      // Non-null guaranteed by the where clause above.
      homeScore: row.homeScore!,
      awayScore: row.awayScore!,
    }));
  }

  // One team's effective rolling stats as of `asOf`, applying the exact same
  // cross-competition fallback policy as BettingEngineService.analyzeFixture
  // (resolveEffectiveTeamStats, @evcore/analysis-core) — European and
  // national-team competitions always blend in cross-comp form when
  // available; domestic leagues only while the current-season sample is
  // thin. `seasonId` scopes the primary lookup; cross-comp explicitly
  // excludes it.
  async loadTeamStats(input: {
    teamId: string;
    seasonId: string;
    competitionCode: string | null;
    asOf: Date;
  }): Promise<TeamStatsInput | null> {
    const { teamId, seasonId, competitionCode, asOf } = input;

    const [primaryStats, gamesPlayedThisSeason] = await Promise.all([
      this.client.teamStats.findFirst({
        where: {
          teamId,
          afterFixture: { seasonId, scheduledAt: { lt: asOf } },
        },
        orderBy: { afterFixture: { scheduledAt: "desc" } },
      }),
      this.client.teamStats.count({
        where: {
          teamId,
          afterFixture: { seasonId, scheduledAt: { lt: asOf } },
        },
      }),
    ]);

    // Only fetch cross-comp stats when they could actually change the
    // outcome — same fetch-avoidance as the live engine (European/
    // national-team always try; domestic only while thin).
    const mayNeedCrossComp =
      isEuropeanCompetition(competitionCode) ||
      isNationalTeamCompetition(competitionCode) ||
      gamesPlayedThisSeason < DOMESTIC_SEASON_ROLLOVER_MIN_GAMES;

    const crossCompStats = mayNeedCrossComp
      ? await this.client.teamStats.findFirst({
          where: {
            teamId,
            afterFixture: { scheduledAt: { lt: asOf }, seasonId: { not: seasonId } },
          },
          orderBy: { afterFixture: { scheduledAt: "desc" } },
        })
      : null;

    return resolveEffectiveTeamStats({
      competitionCode,
      primaryStats,
      crossCompStats,
      gamesPlayedThisSeason,
    });
  }

  // Finished head-to-head legs strictly before `asOf`, newest first — point-
  // in-time-safe by construction (`scheduledAt: { lt: asOf }`), same query
  // as H2HService.fetchLegs.
  async loadH2HLegs(input: {
    homeTeamId: string;
    awayTeamId: string;
    asOf: Date;
    limit?: number;
  }): Promise<H2HLeg[]> {
    const { homeTeamId, awayTeamId, asOf, limit = H2H_LIMIT_DEFAULT } = input;

    const fixtures = await this.client.fixture.findMany({
      where: {
        status: FixtureStatus.FINISHED,
        scheduledAt: { lt: asOf },
        OR: [
          { homeTeamId, awayTeamId },
          { homeTeamId: awayTeamId, awayTeamId: homeTeamId },
        ],
      },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
      },
      orderBy: { scheduledAt: "desc" },
      take: limit,
    });

    return fixtures
      .filter(
        (fixture) => fixture.homeScore !== null && fixture.awayScore !== null,
      )
      .map((fixture) => ({
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeScore: fixture.homeScore as number,
        awayScore: fixture.awayScore as number,
      }));
  }

  // Convenience wrappers — fetch + compute in one call, mirroring
  // H2HService's public methods so a replay script reads the same shape
  // whether it's driving the live engine or the harness.
  async loadH2HScore(input: {
    homeTeamId: string;
    awayTeamId: string;
    favoriteTeamId: string;
    asOf: Date;
  }): Promise<number | null> {
    const legs = await this.loadH2HLegs(input);
    return computeH2HScoreFromLegs(legs, input.favoriteTeamId);
  }

  async loadH2HMarketSignals(input: {
    homeTeamId: string;
    awayTeamId: string;
    asOf: Date;
  }): Promise<H2HMarketSignals> {
    const legs = await this.loadH2HLegs(input);
    return computeH2HMarketSignalsFromLegs(legs, input);
  }

  async loadH2HScorelineSignal(input: {
    homeTeamId: string;
    awayTeamId: string;
    asOf: Date;
  }): Promise<H2HScorelineSignal> {
    const legs = await this.loadH2HLegs(input);
    return computeH2HScorelineSignalFromLegs(legs, input);
  }

  // Rest + upcoming-schedule-density congestion score as of `asOf` — same
  // query shape as CongestionService.fetchTeamCongestionInputs. The
  // "upcoming fixtures" side reads SCHEDULED calendar entries after `asOf`,
  // which is legitimate pre-match knowledge (a fixture list), never a
  // result — it doesn't violate the point-in-time guarantee.
  async loadCongestionScore(input: {
    homeTeamId: string;
    awayTeamId: string;
    asOf: Date;
  }): Promise<number> {
    const [homeInputs, awayInputs] = await Promise.all([
      this.fetchTeamCongestionInputs(input.homeTeamId, input.asOf),
      this.fetchTeamCongestionInputs(input.awayTeamId, input.asOf),
    ]);
    return computeCongestionScoreFromTeams(homeInputs, awayInputs);
  }

  private async fetchTeamCongestionInputs(
    teamId: string,
    asOf: Date,
  ): Promise<TeamCongestionInputs> {
    const [lastPlayedFixture, upcomingFixtureCount] = await Promise.all([
      this.client.fixture.findFirst({
        where: {
          status: FixtureStatus.FINISHED,
          scheduledAt: { lt: asOf },
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        },
        select: { scheduledAt: true },
        orderBy: { scheduledAt: "desc" },
      }),
      this.client.fixture.count({
        where: {
          status: FixtureStatus.SCHEDULED,
          scheduledAt: {
            gt: asOf,
            lte: new Date(asOf.getTime() + CONGESTION_UPCOMING_WINDOW_MS),
          },
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        },
      }),
    ]);

    return {
      lastPlayedAt: lastPlayedFixture?.scheduledAt ?? null,
      upcomingFixtureCount,
      fixtureDate: asOf,
    };
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
