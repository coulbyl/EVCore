/// <reference types="node" />
/**
 * League input audit — run with: pnpm --filter @evcore/db db:audit:sa-away
 * Requires DATABASE_URL in the environment.
 * Writes packages/db/reports/sa-away-audit.txt.
 *
 * Focus:
 * - SA and BL1 league data health
 * - whether the betting engine has enough inputs to analyze upcoming fixtures
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

const TARGET_LEAGUES = ["SA", "BL1"] as const;
const UPCOMING_WINDOW_DAYS = 7;

type LeagueCode = (typeof TARGET_LEAGUES)[number];

type LeagueFixtureRow = {
  id: string;
  externalId: number;
  status: string;
  scheduledAt: Date;
  xgUnavailable: boolean;
  homeXg: unknown;
  awayXg: unknown;
  season: {
    name: string;
    competition: {
      code: string;
      name: string;
    };
  };
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  modelRuns: {
    analyzedAt: Date;
    decision: string;
  }[];
};

type FixtureAuditRow = {
  code: LeagueCode;
  season: string;
  fixtureId: string;
  fixtureExternalId: number;
  scheduledAt: Date;
  scheduledDay: string;
  homeTeam: string;
  awayTeam: string;
  hasHomeStats: boolean;
  hasAwayStats: boolean;
  hasOneXTwoOdds: boolean;
  latestRunDecision: string | null;
  latestRunAt: Date | null;
};

function hasXg(row: Pick<LeagueFixtureRow, "homeXg" | "awayXg">): boolean {
  return row.homeXg !== null && row.awayXg !== null;
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "-";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function pad(value: string, size: number): string {
  return value.padEnd(size);
}

async function main() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);
  const upcomingEnd = new Date(
    now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const fixtures = (await prisma.fixture.findMany({
    where: {
      season: {
        competition: {
          code: { in: [...TARGET_LEAGUES] },
        },
      },
    },
    select: {
      id: true,
      externalId: true,
      status: true,
      scheduledAt: true,
      xgUnavailable: true,
      homeXg: true,
      awayXg: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      season: {
        select: {
          name: true,
          competition: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
      modelRuns: {
        select: {
          analyzedAt: true,
          decision: true,
        },
        orderBy: { analyzedAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
  })) as LeagueFixtureRow[];

  const relevantUpcoming = fixtures.filter(
    (fixture) =>
      fixture.status === "SCHEDULED" &&
      fixture.scheduledAt >= now &&
      fixture.scheduledAt <= upcomingEnd,
  );

  const upcomingTeamIds = Array.from(
    new Set(
      relevantUpcoming.flatMap((fixture) => [
        fixture.homeTeamId,
        fixture.awayTeamId,
      ]),
    ),
  );
  const upcomingFixtureIds = relevantUpcoming.map((fixture) => fixture.id);

  const [teamStatsRows, oneXTwoOddsRows] = await Promise.all([
    prisma.teamStats.findMany({
      where: {
        teamId: { in: upcomingTeamIds },
        afterFixture: { scheduledAt: { lt: upcomingEnd } },
      },
      select: {
        teamId: true,
        afterFixture: {
          select: {
            scheduledAt: true,
          },
        },
      },
      orderBy: { afterFixture: { scheduledAt: "desc" } },
    }),
    prisma.oddsSnapshot.findMany({
      where: {
        fixtureId: { in: upcomingFixtureIds },
        market: "ONE_X_TWO",
        homeOdds: { not: null },
        drawOdds: { not: null },
        awayOdds: { not: null },
      },
      select: {
        fixtureId: true,
        snapshotAt: true,
      },
      orderBy: [{ fixtureId: "asc" }, { snapshotAt: "desc" }],
    }),
  ]);

  const latestStatsByTeam = new Map<string, Date>();
  for (const row of teamStatsRows) {
    if (!latestStatsByTeam.has(row.teamId)) {
      latestStatsByTeam.set(row.teamId, row.afterFixture.scheduledAt);
    }
  }

  const latestOddsByFixture = new Map<string, Date>();
  for (const row of oneXTwoOddsRows) {
    if (!latestOddsByFixture.has(row.fixtureId)) {
      latestOddsByFixture.set(row.fixtureId, row.snapshotAt);
    }
  }

  const fixtureAudit: FixtureAuditRow[] = relevantUpcoming.map((fixture) => {
    const code = fixture.season.competition.code as LeagueCode;
    const homeStatsAt = latestStatsByTeam.get(fixture.homeTeamId) ?? null;
    const awayStatsAt = latestStatsByTeam.get(fixture.awayTeamId) ?? null;
    const latestOddsAt = latestOddsByFixture.get(fixture.id) ?? null;
    const latestRun = fixture.modelRuns[0] ?? null;

    return {
      code,
      season: fixture.season.name,
      fixtureId: fixture.id,
      fixtureExternalId: fixture.externalId,
      scheduledAt: fixture.scheduledAt,
      scheduledDay: fixture.scheduledAt.toISOString().slice(0, 10),
      homeTeam: fixture.homeTeam.name,
      awayTeam: fixture.awayTeam.name,
      hasHomeStats:
        homeStatsAt !== null &&
        homeStatsAt.getTime() < fixture.scheduledAt.getTime(),
      hasAwayStats:
        awayStatsAt !== null &&
        awayStatsAt.getTime() < fixture.scheduledAt.getTime(),
      hasOneXTwoOdds:
        latestOddsAt !== null &&
        latestOddsAt.getTime() <= fixture.scheduledAt.getTime(),
      latestRunDecision: latestRun?.decision ?? null,
      latestRunAt: latestRun?.analyzedAt ?? null,
    };
  });

  const lines: string[] = [];
  const w = (line = "") => lines.push(line);

  w("═══════════════════════════════════════════════════════");
  w("  EVCore — SA / BL1 Input Audit");
  w(`  Generated : ${now.toISOString()}`);
  w(`  Window    : now -> +${UPCOMING_WINDOW_DAYS} days`);
  w("═══════════════════════════════════════════════════════");
  w();

  for (const code of TARGET_LEAGUES) {
    const leagueFixtures = fixtures.filter(
      (fixture) => fixture.season.competition.code === code,
    );
    const finished = leagueFixtures.filter(
      (fixture) => fixture.status === "FINISHED",
    );
    const scheduled = leagueFixtures.filter(
      (fixture) => fixture.status === "SCHEDULED",
    );
    const upcoming = fixtureAudit.filter((fixture) => fixture.code === code);
    const withXg = finished.filter((fixture) => hasXg(fixture)).length;
    const xgUnavailable = leagueFixtures.filter(
      (fixture) => fixture.xgUnavailable,
    ).length;
    const withModelRun = leagueFixtures.filter(
      (fixture) => fixture.modelRuns.length > 0,
    ).length;
    const analyzableUpcoming = upcoming.filter(
      (fixture) =>
        fixture.hasHomeStats && fixture.hasAwayStats && fixture.hasOneXTwoOdds,
    ).length;
    const todayFixtures = upcoming.filter(
      (fixture) =>
        fixture.scheduledAt >= todayStart && fixture.scheduledAt <= todayEnd,
    );
    const todayMissingOdds = todayFixtures.filter(
      (fixture) => !fixture.hasOneXTwoOdds,
    );
    const missingStatsUpcoming = upcoming.filter(
      (fixture) => !fixture.hasHomeStats || !fixture.hasAwayStats,
    ).length;
    const missingOddsUpcoming = upcoming.filter(
      (fixture) => !fixture.hasOneXTwoOdds,
    ).length;

    w(`League ${code}`);
    w(`  fixtures total         : ${leagueFixtures.length}`);
    w(`  finished               : ${finished.length}`);
    w(`  scheduled              : ${scheduled.length}`);
    w(
      `  xG coverage finished   : ${withXg}/${finished.length} (${pct(withXg, finished.length)})`,
    );
    w(`  xgUnavailable flags    : ${xgUnavailable}`);
    w(`  fixtures with modelRun : ${withModelRun}`);
    w(`  upcoming ${UPCOMING_WINDOW_DAYS}d    : ${upcoming.length}`);
    w(`  today fixtures         : ${todayFixtures.length}`);
    w(`  today missing odds     : ${todayMissingOdds.length}`);
    w(`  analyzable upcoming    : ${analyzableUpcoming}/${upcoming.length}`);
    w(`  missing stats upcoming : ${missingStatsUpcoming}`);
    w(`  missing odds upcoming  : ${missingOddsUpcoming}`);
    w();

    if (upcoming.length === 0) {
      w("  No upcoming fixtures in audit window.");
      w();
      continue;
    }

    w("  Today without odds");
    if (todayMissingOdds.length === 0) {
      w("  None");
    } else {
      for (const fixture of todayMissingOdds) {
        w(
          `  ${fixture.scheduledDay} ${fixture.scheduledAt.toISOString().slice(11, 16)}  ${fixture.fixtureExternalId}  ${fixture.homeTeam} vs ${fixture.awayTeam}`,
        );
      }
    }
    w();

    w("  Upcoming fixture audit");
    w(
      "  DATE        TIME   EXT_ID    SEASON     HOME vs AWAY                           STATS        ODDS       RUN",
    );
    for (const fixture of upcoming) {
      const statsLabel =
        fixture.hasHomeStats && fixture.hasAwayStats
          ? "stats:yes"
          : fixture.hasHomeStats || fixture.hasAwayStats
            ? "stats:partial"
            : "stats:no";
      const oddsLabel = fixture.hasOneXTwoOdds ? "odds:yes" : "odds:no";
      const runLabel = fixture.latestRunDecision
        ? `run:${fixture.latestRunDecision}`
        : "run:none";
      const teams = `${fixture.homeTeam} vs ${fixture.awayTeam}`.slice(0, 38);

      w(
        `  ${fixture.scheduledDay}  ${fixture.scheduledAt.toISOString().slice(11, 16)}  ${String(fixture.fixtureExternalId).padEnd(8)}  ${pad(fixture.season, 9)}  ${pad(teams, 38)} ${pad(statsLabel, 12)} ${pad(oddsLabel, 10)} ${runLabel}`,
      );
    }
    w();
  }

  w("Notes");
  w(
    "  - `analyzable upcoming` means: home stats + away stats + 1X2 odds all exist before kickoff.",
  );
  w(
    "  - This audit checks data availability for the engine path, not backtest output.",
  );
  w(
    "  - If a league has upcoming fixtures but analyzable=0, the model effectively cannot pass there today.",
  );
  w();

  const output = `${lines.join("\n")}\n`;
  console.log(output);

  const reportsDir = join(__dirname, "..", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const filePath = join(reportsDir, "sa-away-audit.txt");
  writeFileSync(filePath, output, "utf8");
  console.log(`Report written to ${filePath}`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`League input audit failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
