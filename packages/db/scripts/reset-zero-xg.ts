/// <reference types="node" />
import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/client";

type Args = {
  apply: boolean;
  codes: string[];
};

function parseArgs(argv: string[]): Args {
  const apply = argv.includes("--apply");
  const codesArg = argv.find((arg) => arg.startsWith("--codes="));
  const codes = codesArg
    ? codesArg
        .slice("--codes=".length)
        .split(",")
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean)
    : [];

  return { apply, codes };
}

async function main() {
  const { apply, codes } = parseArgs(process.argv.slice(2));

  const where = {
    homeXg: 0,
    awayXg: 0,
    xgUnavailable: false,
    ...(codes.length > 0
      ? {
          season: {
            competition: {
              code: { in: codes },
            },
          },
        }
      : {}),
  };
  const codesFilter =
    codes.length > 0
      ? Prisma.sql`AND c.code IN (${Prisma.join(codes)})`
      : Prisma.empty;

  const [count, sample, leagues] = await Promise.all([
    prisma.fixture.count({ where }),
    prisma.fixture.findMany({
      where,
      take: 10,
      orderBy: { scheduledAt: "desc" },
      select: {
        externalId: true,
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
    }),
    prisma.$queryRaw<
      Array<{ code: string; name: string; fixture_count: bigint }>
    >`
      SELECT
        c.code,
        c.name,
        COUNT(f.id) AS fixture_count
      FROM fixture f
      JOIN season s ON s.id = f."seasonId"
      JOIN competition c ON c.id = s."competitionId"
      WHERE f."homeXg" = 0
        AND f."awayXg" = 0
        AND f."xgUnavailable" = false
        ${codesFilter}
      GROUP BY c.code, c.name
      ORDER BY c.code
    `,
  ]);

  console.log("Zero-xG fixture cleanup");
  console.log(`Mode   : ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Codes  : ${codes.length > 0 ? codes.join(", ") : "ALL"}`);
  console.log(`Target : ${count} fixtures`);
  console.log("");

  if (leagues.length > 0) {
    console.log("By league:");
    for (const league of leagues) {
      console.log(
        `  ${league.code.padEnd(4)} ${String(league.fixture_count).padStart(
          5,
        )}  ${league.name}`,
      );
    }
    console.log("");
  }

  if (sample.length > 0) {
    console.log("Sample:");
    for (const fixture of sample) {
      console.log(
        `  ${fixture.season.competition.code.padEnd(4)} ${
          fixture.externalId
        }  ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}  ${fixture.scheduledAt.toISOString()}`,
      );
    }
    console.log("");
  }

  if (!apply) {
    console.log(
      "Dry run only. Re-run with --apply to reset homeXg/awayXg to null.",
    );
    return;
  }

  const result = await prisma.fixture.updateMany({
    where,
    data: {
      homeXg: null,
      awayXg: null,
      xgUnavailable: false,
    },
  });

  console.log(`Updated: ${result.count} fixtures`);
  console.log("These fixtures remain eligible for future stats-sync retries.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
