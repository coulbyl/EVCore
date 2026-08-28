import { prisma } from "@evcore/db";
import { STRATEGY_CHANNEL } from "@evcore/analysis-core";
import type { Config } from "../config";

// Fixtures whose Phase-1/2/3 decisions are worth reading: kickoff is close
// enough that odds/lineups are settling, but not so far in the past that
// re-analyzing it is pointless. Widened on the past side to also cover a
// match that just kicked off (decisions are still the pre-match read).
const LOOKBACK_HOURS = 2;
const LOOKAHEAD_HOURS = 48;

/** Fixture ids that have at least one non-VANTAGE channel decision and do not
 * already have a VANTAGE decision on their latest ModelRun. Scoped to
 * `config.competitionCodes` when set — an empty list means "every active
 * competition", never a silent default (see config.ts). */
export async function findEligibleFixtureIds(
  config: Config,
): Promise<string[]> {
  const now = new Date();
  const from = new Date(now.getTime() - LOOKBACK_HOURS * 3_600_000);
  const to = new Date(now.getTime() + LOOKAHEAD_HOURS * 3_600_000);

  const fixtures = await prisma.fixture.findMany({
    where: {
      scheduledAt: { gte: from, lte: to },
      ...(config.competitionCodes.length > 0
        ? {
            season: {
              competition: { code: { in: config.competitionCodes } },
            },
          }
        : {}),
      modelRuns: {
        some: {
          channelDecisions: {
            some: { channel: { not: STRATEGY_CHANNEL.VANTAGE } },
          },
        },
      },
    },
    select: {
      id: true,
      modelRuns: {
        orderBy: { analyzedAt: "desc" },
        take: 1,
        select: {
          channelDecisions: {
            where: { channel: STRATEGY_CHANNEL.VANTAGE },
            select: { id: true },
          },
        },
      },
    },
  });

  return fixtures
    .filter((f) => (f.modelRuns[0]?.channelDecisions.length ?? 0) === 0)
    .map((f) => f.id);
}
