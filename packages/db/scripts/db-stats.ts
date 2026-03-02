/// <reference types="node" />
/**
 * DB stats — run with: pnpm --filter @evcore/db db:stats
 * Prints a snapshot of ingested data and writes it to packages/db/reports/.
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

async function main() {
  const [
    competitions,
    seasons,
    teams,
    fixtures,
    fixturesByStatus,
    fixturesBySeasonRaw,
    withXg,
    withoutXg,
    oddsSnapshots,
    oddsBookmakers,
    notifications,
  ] = await Promise.all([
    prisma.competition.count(),
    prisma.season.count(),
    prisma.team.count(),
    prisma.fixture.count(),
    prisma.fixture.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.$queryRaw<
      { season: string; total: bigint; finished: bigint; with_xg: bigint }[]
    >`
      SELECT s.name AS season,
             COUNT(f.id)                                        AS total,
             COUNT(f.id) FILTER (WHERE f.status = 'FINISHED')  AS finished,
             COUNT(f.id) FILTER (WHERE f."homeXg" IS NOT NULL) AS with_xg
      FROM   "Fixture" f
      JOIN   "Season"  s ON s.id = f."seasonId"
      GROUP  BY s.name
      ORDER  BY s.name
    `,
    prisma.fixture.count({ where: { homeXg: { not: null } } }),
    prisma.fixture.count({ where: { status: "FINISHED", homeXg: null } }),
    prisma.oddsSnapshot.count(),
    prisma.oddsSnapshot.groupBy({ by: ["bookmaker"], _count: { id: true } }),
    prisma.notification.count(),
  ]);

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dateLabel = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const lines: string[] = [];
  const w = (s = "") => lines.push(s);

  w("═══════════════════════════════════════════");
  w("  EVCore — DB Stats");
  w(`  Generated : ${dateLabel}`);
  w("═══════════════════════════════════════════");
  w();
  w("── Structure ───────────────────────────────");
  w(`  Competitions : ${competitions}`);
  w(`  Seasons      : ${seasons}`);
  w(`  Teams        : ${teams}`);
  w(`  Fixtures     : ${fixtures}`);
  w();
  w("── Fixtures by status ──────────────────────");
  for (const row of fixturesByStatus) {
    w(`  ${row.status.padEnd(14)}: ${row._count.id}`);
  }
  w();
  w("── Fixtures by season ──────────────────────");
  for (const row of fixturesBySeasonRaw) {
    const pct =
      row.total > 0n
        ? Math.round((Number(row.with_xg) / Number(row.total)) * 100)
        : 0;
    w(
      `  ${row.season}  total=${String(row.total).padStart(4)}  finished=${String(row.finished).padStart(4)}  xG=${String(row.with_xg).padStart(4)} (${pct}%)`,
    );
  }
  w();
  w("── xG coverage ─────────────────────────────");
  const xgPct = fixtures > 0 ? Math.round((withXg / fixtures) * 100) : 0;
  w(`  With xG    : ${withXg} / ${fixtures} (${xgPct}%)`);
  w(`  Missing xG : ${withoutXg} finished fixtures`);
  w();
  w("── Odds snapshots ──────────────────────────");
  w(`  Total      : ${oddsSnapshots}`);
  for (const row of oddsBookmakers) {
    w(`  ${row.bookmaker.padEnd(12)}: ${row._count.id}`);
  }
  w();
  w("── Notifications ───────────────────────────");
  w(`  In-app     : ${notifications}`);
  w();

  const output = lines.join("\n");
  console.log(output);

  const reportsDir = join(__dirname, "..", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const filePath = join(reportsDir, `db-stats-${timestamp}.txt`);
  writeFileSync(filePath, output, "utf-8");
  console.log(`Report saved → ${filePath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
