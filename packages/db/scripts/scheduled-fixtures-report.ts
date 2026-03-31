/// <reference types="node" />
/**
 * Scheduled fixtures report — run with: pnpm --filter @evcore/db db:scheduled
 * Prints current scheduled fixture counts and writes
 * packages/db/reports/scheduled-fixtures-YYYY-MM-DD.txt.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

type ScheduledByDateRow = {
  date_utc: string;
  scheduled_count: bigint;
};

type ScheduledByCompetitionDateRow = {
  code: string;
  date_utc: string;
  scheduled_count: bigint;
};

async function main(): Promise<void> {
  const now = new Date();
  const dateLabel = now.toISOString().slice(0, 10);
  const generatedAt = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const [scheduledTotal, byDate, byCompetitionDate] = await Promise.all([
    prisma.fixture.count({ where: { status: "SCHEDULED" } }),
    prisma.$queryRaw<ScheduledByDateRow[]>`
      SELECT
        to_char(date_trunc('day', "scheduledAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date_utc,
        COUNT(*) AS scheduled_count
      FROM fixture
      WHERE status = 'SCHEDULED'
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<ScheduledByCompetitionDateRow[]>`
      SELECT
        c.code,
        to_char(date_trunc('day', f."scheduledAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date_utc,
        COUNT(*) AS scheduled_count
      FROM fixture f
      JOIN season s ON s.id = f."seasonId"
      JOIN competition c ON c.id = s."competitionId"
      WHERE f.status = 'SCHEDULED'
      GROUP BY c.code, 2
      ORDER BY 2, c.code
    `,
  ]);

  const lines: string[] = [];
  const w = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  w("═══════════════════════════════════════════════════════");
  w(`  EVCore — Scheduled Fixtures Report — ${dateLabel}`);
  w(`  Generated : ${generatedAt}`);
  w("═══════════════════════════════════════════════════════");
  w();
  w(`Total SCHEDULED fixtures: ${scheduledTotal}`);
  w();

  w("── By Date (UTC) ─────────────────────────────────────");
  if (byDate.length === 0) {
    w("  No scheduled fixtures in DB.");
  } else {
    for (const row of byDate) {
      w(`  ${row.date_utc}  ${Number(row.scheduled_count)}`);
    }
  }
  w();

  w("── By Competition / Date (UTC) ──────────────────────");
  if (byCompetitionDate.length === 0) {
    w("  No scheduled fixtures in DB.");
  } else {
    for (const row of byCompetitionDate) {
      w(
        `  ${row.date_utc}  ${row.code.padEnd(6)}  ${Number(row.scheduled_count)}`,
      );
    }
  }
  w();
  w("═══════════════════════════════════════════════════════");

  const reportsDir = join(__dirname, "..", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const filePath = join(reportsDir, `scheduled-fixtures-${dateLabel}.txt`);
  writeFileSync(filePath, lines.join("\n"), "utf-8");
  console.log(`\nReport saved → ${filePath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
