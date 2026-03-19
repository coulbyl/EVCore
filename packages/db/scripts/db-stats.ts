/// <reference types="node" />
/**
 * DB stats — run with: pnpm --filter @evcore/db db:stats
 * Prints a system snapshot and writes packages/db/reports/db-stats.txt (fixed filename).
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️ ";

function req(ok: boolean, warn = false): string {
  return ok ? PASS : warn ? WARN : FAIL;
}

async function main() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);
  const couponAuditStartDate = new Date("2026-03-19T00:00:00.000Z");
  const couponAuditEndDate = new Date("2026-03-22T00:00:00.000Z");
  const couponAuditStart = new Date(couponAuditStartDate);
  couponAuditStart.setUTCHours(0, 0, 0, 0);
  const couponAuditEnd = new Date(couponAuditEndDate);
  couponAuditEnd.setUTCHours(23, 59, 59, 999);

  type LeagueRow = {
    code: string;
    name: string;
    active: boolean;
    fixtures: bigint;
    finished: bigint;
    with_xg: bigint;
    with_odds: bigint;
    team_stats: bigint;
  };

  type OddsLeagueRow = { code: string; cnt: bigint };
  type TodayOddsRow = { cnt: bigint };
  type LeagueZeroXgRow = {
    code: string;
    name: string;
    total_stats: bigint;
    zero_for: bigint;
    zero_against: bigint;
    zero_both: bigint;
  };
  type ScheduledFixtureRow = {
    scheduledAt: Date;
    season: {
      competition: {
        code: string;
        name: string;
      };
    };
    homeTeam: { name: string };
    awayTeam: { name: string };
  };
  type CouponAuditFixtureRow = {
    id: string;
    scheduledAt: Date;
    season: {
      competition: {
        code: string;
        name: string;
      };
    };
    homeTeamId: string;
    awayTeamId: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
    oddsSnapshots: { id: string }[];
    modelRuns: {
      analyzedAt: Date;
      decision: string;
      bets: {
        id: string;
        market: string;
        pick: string;
        comboMarket: string | null;
        comboPick: string | null;
        status: string;
        ev: unknown;
      }[];
    }[];
  };

  const [
    fixturesByStatus,
    leagueBreakdown,
    withXg,
    oddsTotal,
    oddsBookmakers,
    oddsPerLeague,
    zeroXgByLeague,
    teamStatsTotal,
    modelRunsTotal,
    betsTotal,
    betsByStatus,
    betsByMarket,
    couponsTotal,
    couponsByStatus,
    latestCoupon,
    todayFixtures,
    todayWithOddsRaw,
    settledBets,
    adjustmentProposals,
    activeSuspensions,
    notifications,
    unreadNotifications,
    couponAuditFixtures,
    couponAuditEligibilityFixtures,
  ] = await Promise.all([
    prisma.fixture.groupBy({ by: ["status"], _count: { id: true } }),

    prisma.$queryRaw<LeagueRow[]>`
      SELECT
        c.code,
        c.name,
        c."isActive"                                                    AS active,
        COUNT(DISTINCT f.id)                                            AS fixtures,
        COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'FINISHED')      AS finished,
        COUNT(DISTINCT f.id) FILTER (WHERE f."homeXg" IS NOT NULL)     AS with_xg,
        COUNT(DISTINCT o."fixtureId")                                   AS with_odds,
        COUNT(DISTINCT ts.id)                                           AS team_stats
      FROM competition c
      JOIN season      s  ON s."competitionId" = c.id
      LEFT JOIN fixture        f  ON f."seasonId" = s.id
      LEFT JOIN odds_snapshot  o  ON o."fixtureId" = f.id
      LEFT JOIN team_stats     ts ON ts."afterFixtureId" = f.id
      GROUP BY c.code, c.name, c."isActive"
      ORDER BY c."isActive" DESC, c.name
    `,

    prisma.fixture.count({ where: { homeXg: { not: null } } }),

    prisma.oddsSnapshot.count(),
    prisma.oddsSnapshot.groupBy({ by: ["bookmaker"], _count: { id: true } }),
    prisma.$queryRaw<OddsLeagueRow[]>`
      SELECT c.code, COUNT(o.id) AS cnt
      FROM odds_snapshot o
      JOIN fixture       f ON f.id = o."fixtureId"
      JOIN season        s ON s.id = f."seasonId"
      JOIN competition   c ON c.id = s."competitionId"
      GROUP BY c.code
      ORDER BY c.code
    `,

    prisma.$queryRaw<LeagueZeroXgRow[]>`
      SELECT
        c.code,
        c.name,
        COUNT(ts.id) AS total_stats,
        COUNT(ts.id) FILTER (WHERE ts."xgFor" = 0) AS zero_for,
        COUNT(ts.id) FILTER (WHERE ts."xgAgainst" = 0) AS zero_against,
        COUNT(ts.id) FILTER (WHERE ts."xgFor" = 0 AND ts."xgAgainst" = 0) AS zero_both
      FROM team_stats ts
      JOIN team        t ON t.id = ts."teamId"
      JOIN competition c ON c.id = t."competitionId"
      GROUP BY c.code, c.name
      ORDER BY c.code
    `,

    prisma.teamStats.count(),

    prisma.modelRun.count(),
    prisma.bet.count(),
    prisma.bet.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.bet.groupBy({
      by: ["market"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),

    prisma.dailyCoupon.count(),
    prisma.dailyCoupon.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.dailyCoupon.findFirst({
      orderBy: { createdAt: "desc" },
      select: { date: true, status: true, legCount: true, createdAt: true },
    }),

    prisma.fixture.count({
      where: { scheduledAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.$queryRaw<TodayOddsRow[]>`
      SELECT COUNT(DISTINCT f.id) AS cnt
      FROM fixture        f
      JOIN odds_snapshot  o ON o."fixtureId" = f.id
      WHERE f."scheduledAt" BETWEEN ${todayStart} AND ${todayEnd}
    `,

    prisma.bet.count({ where: { status: { in: ["WON", "LOST", "VOID"] } } }),
    prisma.adjustmentProposal.count(),
    prisma.marketSuspension.count({ where: { active: true } }),

    prisma.notification.count(),
    prisma.notification.count({ where: { read: false } }),
    prisma.fixture.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { gte: couponAuditStart, lte: couponAuditEnd },
      },
      select: {
        scheduledAt: true,
        season: {
          select: {
            competition: {
              select: { code: true, name: true },
            },
          },
        },
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
      orderBy: [{ scheduledAt: "asc" }],
    }) as Promise<ScheduledFixtureRow[]>,
    prisma.fixture.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { gte: couponAuditStart, lte: couponAuditEnd },
      },
      select: {
        id: true,
        scheduledAt: true,
        season: {
          select: {
            competition: {
              select: { code: true, name: true },
            },
          },
        },
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        oddsSnapshots: {
          select: { id: true },
          take: 1,
        },
        modelRuns: {
          select: {
            analyzedAt: true,
            decision: true,
            bets: {
              select: {
                id: true,
                market: true,
                pick: true,
                comboMarket: true,
                comboPick: true,
                status: true,
                ev: true,
              },
            },
          },
          orderBy: { analyzedAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ scheduledAt: "asc" }],
    }) as Promise<CouponAuditFixtureRow[]>,
  ]);

  const couponAuditTeamIds = Array.from(
    new Set(
      couponAuditEligibilityFixtures.flatMap((fixture) => [
        fixture.homeTeamId,
        fixture.awayTeamId,
      ]),
    ),
  );
  const latestTeamStats = await prisma.teamStats.findMany({
    where: {
      teamId: { in: couponAuditTeamIds },
      afterFixture: { scheduledAt: { lt: couponAuditEnd } },
    },
    select: {
      teamId: true,
      afterFixture: { select: { scheduledAt: true } },
    },
    orderBy: { afterFixture: { scheduledAt: "desc" } },
  });
  const teamStatsCoverage = new Set<string>();
  for (const row of latestTeamStats) {
    if (!teamStatsCoverage.has(row.teamId)) {
      teamStatsCoverage.add(row.teamId);
    }
  }

  const dateLabel = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const todayWithOddsCount = Number(todayWithOddsRaw[0]?.cnt ?? 0n);

  // ── Derived checks ──────────────────────────────────────────────────────────
  const finishedCount =
    fixturesByStatus.find((r) => r.status === "FINISHED")?._count.id ?? 0;
  const xgCoverage =
    finishedCount > 0 ? Math.round((withXg / finishedCount) * 100) : 0;
  const activeLeagueStats = leagueBreakdown.filter((r) => r.active);
  const leaguesWithStats = activeLeagueStats.filter(
    (r) => r.team_stats > 0n,
  ).length;
  const leaguesWithOdds = activeLeagueStats.filter(
    (r) => r.with_odds > 0n,
  ).length;

  const lines: string[] = [];
  const w = (s = "") => lines.push(s);

  // ═══ Header ═════════════════════════════════════════════════════════════════
  w("═══════════════════════════════════════════════════════");
  w("  EVCore — System Status");
  w(`  Generated : ${dateLabel}`);
  w("═══════════════════════════════════════════════════════");
  w();

  // ── Requirements checklist ──────────────────────────────────────────────────
  w("── Requirements ────────────────────────────────────────");
  w();
  w("  PIPELINE STAGE            STATUS   DETAIL");
  w("  ───────────────────────────────────────────────────────");

  const etlOk = activeLeagueStats.every((r) => r.fixtures > 0n);
  w(
    `  1. ETL — fixtures synced   ${req(etlOk)}    ${activeLeagueStats.filter((r) => r.fixtures > 0n).length} / ${activeLeagueStats.length} active leagues`,
  );

  const xgOk = xgCoverage >= 80;
  const xgWarn = xgCoverage >= 50;
  w(
    `  2. xG coverage             ${req(xgOk, !xgOk && xgWarn)}    ${xgCoverage}% of finished fixtures`,
  );

  const oddsOk = leaguesWithOdds === activeLeagueStats.length;
  const oddsWarn = leaguesWithOdds > 0;
  w(
    `  3. Odds synced             ${req(oddsOk, !oddsOk && oddsWarn)}    ${leaguesWithOdds} / ${activeLeagueStats.length} active leagues`,
  );

  const rollingOk = leaguesWithStats === activeLeagueStats.length;
  const rollingWarn = leaguesWithStats > 0;
  w(
    `  4. Rolling stats           ${req(rollingOk, !rollingOk && rollingWarn)}    ${leaguesWithStats} / ${activeLeagueStats.length} leagues — ${teamStatsTotal.toLocaleString()} records`,
  );

  const backtestOk = teamStatsTotal > 0 && finishedCount > 100;
  w(
    `  5. Backtest ready          ${req(backtestOk)}    ${modelRunsTotal.toLocaleString()} model runs, ${betsTotal.toLocaleString()} bets`,
  );

  const couponOk = todayFixtures > 0 && todayWithOddsCount > 0;
  const couponWarn = todayFixtures > 0;
  w(
    `  6. Coupon today            ${req(couponOk, !couponOk && couponWarn)}    ${todayFixtures} fixtures scheduled, ${todayWithOddsCount} with odds`,
  );

  const loopOk = settledBets >= 50;
  const loopWarn = settledBets > 0;
  w(
    `  7. Learning loop           ${req(loopOk, !loopOk && loopWarn)}    ${settledBets} settled bets (need ≥ 50)`,
  );

  w();

  // ── Leagues ─────────────────────────────────────────────────────────────────
  w("── Leagues ─────────────────────────────────────────────");
  w();
  w("  CODE  ACTIVE  FIXTURES  FINISHED  xG (done/fin)   ODDS   STATS");
  w("  ────────────────────────────────────────────────────────────────");
  for (const r of leagueBreakdown) {
    const total = Number(r.fixtures);
    const fin = Number(r.finished);
    const xg = Number(r.with_xg);
    const xgP = fin > 0 ? Math.round((xg / fin) * 100) : 0;
    const xgLabel = `${xg}/${fin} (${String(xgP).padStart(3)}%)`;
    const active = r.active ? "✓" : " ";
    w(
      `  ${r.code.padEnd(4)}  ${active.padEnd(6)}  ${String(total).padStart(8)}  ${String(fin).padStart(8)}  ${xgLabel.padEnd(16)} ${String(Number(r.with_odds)).padStart(5)}  ${String(Number(r.team_stats)).padStart(5)}`,
    );
  }
  w();

  // ── Odds ─────────────────────────────────────────────────────────────────────
  w("── Odds snapshots ──────────────────────────────────────");
  w(`  Total : ${oddsTotal.toLocaleString()}`);
  for (const b of oddsBookmakers) {
    w(`  ${b.bookmaker.padEnd(14)}: ${b._count.id.toLocaleString()}`);
  }
  if (oddsPerLeague.length > 0) {
    w("  Per league:");
    for (const r of oddsPerLeague) {
      w(`    ${r.code.padEnd(4)}: ${Number(r.cnt).toLocaleString()}`);
    }
  }
  w();

  // ── Zero xG in team stats ───────────────────────────────────────────────────
  w("── TeamStats zero-xG audit ─────────────────────────────");
  w("  CODE  TOTAL   xgFor=0  xgAgainst=0  both=0");
  w("  ─────────────────────────────────────────────────────");
  for (const r of zeroXgByLeague) {
    const total = Number(r.total_stats);
    const zeroFor = Number(r.zero_for);
    const zeroAgainst = Number(r.zero_against);
    const zeroBoth = Number(r.zero_both);
    if (zeroFor === 0 && zeroAgainst === 0 && zeroBoth === 0) continue;
    w(
      `  ${r.code.padEnd(4)}  ${String(total).padStart(5)}  ${String(zeroFor).padStart(7)}  ${String(zeroAgainst).padStart(11)}  ${String(zeroBoth).padStart(6)}  ${r.name}`,
    );
  }
  w();

  // ── Model / Bets ─────────────────────────────────────────────────────────────
  w("── Model runs & bets ───────────────────────────────────");
  w(`  Model runs : ${modelRunsTotal.toLocaleString()}`);
  w(`  Bets total : ${betsTotal.toLocaleString()}`);
  for (const r of betsByStatus) {
    w(`    ${r.status.padEnd(12)}: ${r._count.id}`);
  }
  w("  Per market:");
  for (const r of betsByMarket) {
    w(`    ${r.market.padEnd(20)}: ${r._count.id}`);
  }
  w();

  // ── Coupons ──────────────────────────────────────────────────────────────────
  w("── Daily coupons ───────────────────────────────────────");
  w(`  Total : ${couponsTotal}`);
  for (const r of couponsByStatus) {
    w(`  ${r.status.padEnd(12)}: ${r._count.id}`);
  }
  if (latestCoupon) {
    const legWord = latestCoupon.legCount !== 1 ? "legs" : "leg";
    w(
      `  Latest: ${latestCoupon.date.toISOString().slice(0, 10)} — ${latestCoupon.status} (${latestCoupon.legCount} ${legWord}) — created ${latestCoupon.createdAt.toISOString().slice(0, 16)} UTC`,
    );
  }
  w();

  // ── Learning loop ─────────────────────────────────────────────────────────────
  w("── Learning loop ───────────────────────────────────────");
  const loopNote =
    settledBets >= 50 ? "(loop eligible)" : `(need ${50 - settledBets} more)`;
  w(`  Settled bets        : ${settledBets} ${loopNote}`);
  w(`  Adjustment proposals: ${adjustmentProposals}`);
  w(`  Active suspensions  : ${activeSuspensions}`);
  w();

  // ── Notifications ─────────────────────────────────────────────────────────────
  w("── Notifications ───────────────────────────────────────");
  w(`  Total  : ${notifications}`);
  w(`  Unread : ${unreadNotifications}`);
  w();
  // ── Coupon audit — group by date then league ────────────────────────────────
  const auditPeriod = `${couponAuditStartDate.toISOString().slice(0, 10)} → ${couponAuditEndDate.toISOString().slice(0, 10)}`;

  w("── Scheduled fixtures audit ────────────────────────────");
  w(`  Period: ${auditPeriod} — ${couponAuditFixtures.length} fixtures`);

  if (couponAuditFixtures.length === 0) {
    w("  None");
  } else {
    // Group by date
    const byDate = new Map<string, typeof couponAuditFixtures>();
    for (const f of couponAuditFixtures) {
      const day = f.scheduledAt.toISOString().slice(0, 10);
      if (!byDate.has(day)) byDate.set(day, []);
      byDate.get(day)!.push(f);
    }
    for (const [day, fixtures] of byDate) {
      w();
      w(`  ── ${day} ──`);
      // Group by league within the day
      const byLeague = new Map<string, typeof fixtures>();
      for (const f of fixtures) {
        const key = `${f.season.competition.code}|${f.season.competition.name}`;
        if (!byLeague.has(key)) byLeague.set(key, []);
        byLeague.get(key)!.push(f);
      }
      for (const [key, leagueFixtures] of byLeague) {
        const [code, name] = key.split("|") as [string, string];
        w(`    [${code}] ${name}`);
        for (const f of leagueFixtures) {
          const time = f.scheduledAt.toISOString().slice(11, 16);
          w(`      ${time}  ${f.homeTeam.name} vs ${f.awayTeam.name}`);
        }
      }
    }
  }
  w();

  w("── Coupon eligibility audit ────────────────────────────");
  w(`  Period: ${auditPeriod} — ${couponAuditEligibilityFixtures.length} fixtures`);

  if (couponAuditEligibilityFixtures.length === 0) {
    w("  None");
  } else {
    const byDate2 = new Map<string, typeof couponAuditEligibilityFixtures>();
    for (const f of couponAuditEligibilityFixtures) {
      const day = f.scheduledAt.toISOString().slice(0, 10);
      if (!byDate2.has(day)) byDate2.set(day, []);
      byDate2.get(day)!.push(f);
    }
    for (const [day, fixtures] of byDate2) {
      w();
      w(`  ── ${day} ──`);
      const byLeague = new Map<string, typeof fixtures>();
      for (const f of fixtures) {
        const key = `${f.season.competition.code}|${f.season.competition.name}`;
        if (!byLeague.has(key)) byLeague.set(key, []);
        byLeague.get(key)!.push(f);
      }
      for (const [key, leagueFixtures] of byLeague) {
        const [code, name] = key.split("|") as [string, string];
        w(`    [${code}] ${name}`);
        for (const f of leagueFixtures) {
          const time = f.scheduledAt.toISOString().slice(11, 16);
          const hasHomeStats = teamStatsCoverage.has(f.homeTeamId);
          const hasAwayStats = teamStatsCoverage.has(f.awayTeamId);
          const hasOdds = f.oddsSnapshots.length > 0;
          const latestRun = f.modelRuns[0] ?? null;
          const latestBet = latestRun?.bets[0] ?? null;
          const stats =
            hasHomeStats && hasAwayStats
              ? "✅ stats"
              : hasHomeStats || hasAwayStats
                ? "⚠️  stats"
                : "❌ stats";
          const odds = hasOdds ? "✅ odds" : "❌ odds";
          const run = latestRun ? `run:${latestRun.decision}` : "run:—";
          const bet = latestBet
            ? latestBet.comboMarket
              ? `bet:${latestBet.market}+${latestBet.comboMarket}`
              : `bet:${latestBet.market}`
            : "bet:—";
          w(
            `      ${time}  ${f.homeTeam.name} vs ${f.awayTeam.name.padEnd(24)}  ${stats}  ${odds}  ${run.padEnd(14)}  ${bet}`,
          );
        }
      }
    }
  }
  w();
  w("═══════════════════════════════════════════════════════");

  const output = lines.join("\n");
  console.log(output);

  const reportsDir = join(__dirname, "..", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const filePath = join(reportsDir, "db-stats.txt");
  writeFileSync(filePath, output, "utf-8");
  console.log(`\nReport saved → ${filePath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
