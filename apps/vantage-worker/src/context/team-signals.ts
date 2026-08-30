import { prisma } from "@evcore/db";
import type { TeamSignal, CoachSignal } from "./types";

/** Mirrors backend/coach-continuity.constants.ts's NEW_COACH_WINDOW_MATCHES.
 * Duplicated rather than imported — vantage-worker never imports
 * apps/backend (same boundary every other app in this monorepo respects;
 * see README's "why a separate app"). Keep in sync by hand if that constant
 * ever changes. */
const NEW_COACH_WINDOW_MATCHES = 5;

/** Same query shape as betting-engine.service.ts's own team_stats lookup —
 * the latest snapshot strictly before this fixture's kickoff, scoped to the
 * season (point-in-time-safe by construction). Does not replicate that
 * service's European-competition domestic-form fallback — a known
 * simplification, not a bug: VANTAGE degrades to `null` on the same
 * start-of-season gap the deterministic engine has (see project memory
 * project_season_rollover_teamstats_gap), rather than silently diverging
 * from what the fallback would have picked. */
export async function loadTeamSignal(
  teamId: string,
  seasonId: string,
  beforeKickoff: Date,
): Promise<TeamSignal> {
  const row = await prisma.teamStats.findFirst({
    where: {
      teamId,
      afterFixture: { seasonId, scheduledAt: { lt: beforeKickoff } },
    },
    orderBy: { afterFixture: { scheduledAt: "desc" } },
  });
  if (!row) return null;
  return {
    recentForm: row.recentForm.toNumber(),
    xgFor: row.xgFor.toNumber(),
    xgAgainst: row.xgAgainst.toNumber(),
    homeWinRate: row.homeWinRate.toNumber(),
    awayWinRate: row.awayWinRate.toNumber(),
    drawRate: row.drawRate.toNumber(),
    leagueVolatility: row.leagueVolatility.toNumber(),
  };
}

/** A team's finished-match count under its current coach, as of a given
 * fixture — `null` (nothing to say) once that count reaches
 * NEW_COACH_WINDOW_MATCHES; only worth mentioning while it's still live. */
export async function loadCoachSignal(
  teamId: string,
  beforeKickoff: Date,
): Promise<CoachSignal> {
  const tenures = await prisma.coachTenure.findMany({
    where: { teamId, startDate: { lte: beforeKickoff } },
    select: { startDate: true },
    orderBy: { startDate: "desc" },
    take: 1,
  });
  const currentCoachStart = tenures[0]?.startDate;
  if (!currentCoachStart) return null;

  const matchesInCharge = await prisma.fixture.count({
    where: {
      status: "FINISHED",
      scheduledAt: { gte: currentCoachStart, lt: beforeKickoff },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
  });
  if (matchesInCharge >= NEW_COACH_WINDOW_MATCHES) return null;
  return { matchesInCharge };
}
