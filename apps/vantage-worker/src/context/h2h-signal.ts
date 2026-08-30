import { prisma } from "@evcore/db";
import {
  computeH2HScorelineSignalFromLegs,
  H2H_LIMIT_DEFAULT,
  type H2HLeg,
} from "@evcore/analysis-core";
import type { H2HSignal } from "./types";

/** Same leg-fetching shape as apps/backend's H2HService.fetchLegs — finished
 * meetings between the two teams (either venue), point-in-time-safe
 * (`scheduledAt < fixtureDate`), most recent first. Duplicated rather than
 * imported: vantage-worker never imports apps/backend (see team-signals.ts).
 * The pure computation itself (`computeH2HScorelineSignalFromLegs`) is
 * shared from @evcore/analysis-core, so there's no risk of the signal
 * itself drifting from what the live engine/backtest harness compute — only
 * this I/O shell is re-typed here. */
async function fetchLegs(
  homeTeamId: string,
  awayTeamId: string,
  fixtureDate: Date,
): Promise<H2HLeg[]> {
  const fixtures = await prisma.fixture.findMany({
    where: {
      status: "FINISHED",
      scheduledAt: { lt: fixtureDate },
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
    take: H2H_LIMIT_DEFAULT,
  });

  return fixtures
    .filter((f) => f.homeScore !== null && f.awayScore !== null)
    .map((f) => ({
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      homeScore: f.homeScore as number,
      awayScore: f.awayScore as number,
    }));
}

/** The one H2H signal VANTAGE doesn't already see indirectly — see
 * H2HSignal's own doc comment in types.ts for why the 6 per-market H2H
 * signals are deliberately NOT re-exposed here (already folded into every
 * channel's probability upstream). `null` below H2H_MIN_SAMPLE legs. */
export async function loadH2HSignal(
  homeTeamId: string,
  awayTeamId: string,
  fixtureDate: Date,
): Promise<H2HSignal> {
  const legs = await fetchLegs(homeTeamId, awayTeamId, fixtureDate);
  const signal = computeH2HScorelineSignalFromLegs(legs, { homeTeamId });
  if (signal.scoreline === null || signal.confidence === null) return null;
  return {
    scoreline: signal.scoreline,
    confidence: signal.confidence,
    sampleSize: signal.sampleSize,
  };
}
