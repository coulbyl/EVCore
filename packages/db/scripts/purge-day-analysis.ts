import "dotenv/config";
import { prisma } from "../src/client";

function parseDay(day: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("Expected date in YYYY-MM-DD format");
  }

  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(`${day}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function main() {
  const day = process.argv[2];
  if (!day) {
    throw new Error("Usage: tsx scripts/purge-day-analysis.ts YYYY-MM-DD");
  }

  const { start, end } = parseDay(day);

  const fixtureIds = (
    await prisma.fixture.findMany({
      where: {
        scheduledAt: {
          gte: start,
          lt: end,
        },
      },
      select: { id: true },
    })
  ).map((fixture) => fixture.id);

  const modelRunCount = await prisma.modelRun.count({
    where: { fixtureId: { in: fixtureIds } },
  });
  const betCount = await prisma.bet.count({
    where: { fixtureId: { in: fixtureIds } },
  });

  const result = await prisma.$transaction(async (tx) => {
    const deletedBets = await tx.bet.deleteMany({
      where: { fixtureId: { in: fixtureIds } },
    });

    const deletedModelRuns = await tx.modelRun.deleteMany({
      where: { fixtureId: { in: fixtureIds } },
    });

    return {
      deletedBets: deletedBets.count,
      deletedModelRuns: deletedModelRuns.count,
    };
  });

  console.log(
    JSON.stringify(
      {
        day,
        fixtureCount: fixtureIds.length,
        modelRunCount,
        betCount,
        ...result,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
