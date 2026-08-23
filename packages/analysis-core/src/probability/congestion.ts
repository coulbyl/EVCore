// Pure congestion-score math — extracted 2026-08-18 from apps/backend's
// CongestionService so the backtest harness replays the exact same signal.
// Fetching the inputs (last finished fixture before `fixtureDate`, count of
// SCHEDULED fixtures in the following window) stays app-side — reading
// which fixtures are on the calendar is legitimate pre-match knowledge (not
// a result), but the query shape itself belongs with its Prisma client:
// CongestionService in the live engine, PointInTimeLoader in the harness.

// Window used to count "upcoming fixture pile-up" after the target fixture.
export const CONGESTION_UPCOMING_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;
const THREE_DAYS_REST = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeRestPenalty(
  lastMatchDate: Date,
  fixtureDate: Date,
): number {
  const daysSinceLastMatch =
    (fixtureDate.getTime() - lastMatchDate.getTime()) / (24 * 60 * 60 * 1000);
  return clamp((THREE_DAYS_REST - daysSinceLastMatch) / THREE_DAYS_REST, 0, 1);
}

export type TeamCongestionInputs = {
  // Most recent FINISHED fixture strictly before `fixtureDate`, or null if
  // none exists.
  lastPlayedAt: Date | null;
  // Count of SCHEDULED fixtures in
  // (fixtureDate, fixtureDate + CONGESTION_UPCOMING_WINDOW_MS].
  upcomingFixtureCount: number;
  fixtureDate: Date;
};

// Weight rest slightly higher than short-horizon schedule density.
export function computeTeamCongestionScore(
  input: TeamCongestionInputs,
): number {
  const restPenalty =
    input.lastPlayedAt === null
      ? 0
      : computeRestPenalty(input.lastPlayedAt, input.fixtureDate);
  const upcomingPenalty = clamp(input.upcomingFixtureCount / 3, 0, 1);
  return 0.6 * restPenalty + 0.4 * upcomingPenalty;
}

export function computeCongestionScoreFromTeams(
  home: TeamCongestionInputs,
  away: TeamCongestionInputs,
): number {
  return (
    (computeTeamCongestionScore(home) + computeTeamCongestionScore(away)) / 2
  );
}
