/// <reference types="node" />
/**
 * Fills `odds_latest` for the matches the migration 20261031130000 left out
 * (before yesterday at the time it ran). Optional: a match without any row
 * there is read in the history (PlayableOddsRepository). Month by month,
 * newest first, so no single statement holds the table long; replayable
 * (`ON CONFLICT DO NOTHING`: a price the trigger already wrote stays).
 *
 * Run with: pnpm --filter @evcore/db db:backfill:odds-latest
 */
import "dotenv/config";
import { prisma } from "../src/client";

async function oldestKickoff(): Promise<Date | null> {
  const [row] = await prisma.$queryRaw<{ oldest: Date | null }[]>`
    SELECT min(f."scheduledAt") AS oldest
    FROM public.fixture f
    WHERE EXISTS (SELECT 1 FROM public.odds_snapshot o WHERE o."fixtureId" = f.id)
  `;
  return row?.oldest ?? null;
}

async function fillMonth(from: Date, to: Date): Promise<number> {
  return prisma.$executeRaw`
    INSERT INTO public.odds_latest (
      "fixtureId", bookmaker, market, pick, line, "homeOdds", "drawOdds",
      "awayOdds", odds, "snapshotAt", "observedAt", "snapshotId"
    )
    SELECT DISTINCT ON (o."fixtureId", o.bookmaker, o.market, o.pick, o.line)
           o."fixtureId", o.bookmaker, o.market, o.pick, o.line,
           o."homeOdds", o."drawOdds", o."awayOdds", o.odds, o."snapshotAt",
           o."observedAt", o.id
    FROM public.odds_snapshot o
    JOIN public.fixture f ON f.id = o."fixtureId"
    WHERE f."scheduledAt" >= ${from} AND f."scheduledAt" < ${to}
      AND o."snapshotAt" <= f."scheduledAt"
    ORDER BY o."fixtureId", o.bookmaker, o.market, o.pick, o.line,
             o."snapshotAt" DESC, o.id DESC
    ON CONFLICT DO NOTHING
  `;
}

async function main(): Promise<void> {
  const oldest = await oldestKickoff();
  if (!oldest) {
    console.log("[odds-latest] no odds in the history");
    return;
  }
  // Up to yesterday: the migration filled from there on.
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  let total = 0;
  for (let to = end; to > oldest; ) {
    const from = new Date(to);
    from.setUTCMonth(from.getUTCMonth() - 1);
    const started = Date.now();
    const written = await fillMonth(from, to);
    total += written;
    console.log(
      `[odds-latest] ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}: ${written} prices in ${Date.now() - started} ms`,
    );
    to = from;
  }
  console.log(`[odds-latest] done: ${total} prices written`);
}

main()
  .catch((error) => {
    console.error("[odds-latest] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
