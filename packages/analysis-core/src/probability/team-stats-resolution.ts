import type { TeamStatsInput } from "./match-stats";
import { blendTeamStats } from "./match-stats";

// Cross-competition team-stats fallback policy — moved here 2026-08-18 from
// apps/backend's BettingEngineService.analyzeFixture so the backtest harness
// (packages/backtest-core) replays the exact same decision instead of a
// second guess at it. This module only decides HOW to combine stats it's
// given; fetching the primary/cross-comp rows (point-in-time-safe) is the
// caller's job — see PointInTimeLoader.loadTeamStats in backtest-core, and
// BettingEngineService.analyzeFixture in the live engine.

// ─── European competitions ───────────────────────────────────────────────

// All competition codes treated as European (UCL/UEL/UECL + legacy alias LDC).
export const EUROPEAN_COMPETITION_CODE_SET = new Set([
  "UCL",
  "UEL",
  "UECL",
  "LDC",
]);

export function isEuropeanCompetition(
  code: string | null | undefined,
): boolean {
  return code != null && EUROPEAN_COMPETITION_CODE_SET.has(code);
}

// Cross-competition form blending weights for European fixture analysis.
// European recentForm is weighted higher (direct competitive context).
// Domestic xg is weighted higher (30+ match sample vs 5-8 European matches).
export const EUROPEAN_CROSS_COMP_FORM_WEIGHT = 0.6;
export const EUROPEAN_CROSS_COMP_XG_WEIGHT = 0.4;

// ─── National team competitions ────────────────────────────────────────────

// Competitions involving national teams. These have no prior in-tournament
// stats at the start of the event, so cross-comp fallback (qualifiers,
// Nations League) is required to produce any analysis at all.
export const NATIONAL_TEAM_COMPETITION_CODE_SET = new Set([
  "WC",
  "WCQE",
  "WCQCA",
  "WCQSA",
  "WCQAS",
  "WCQAF",
  "WCQOC",
  "UNL",
  "CAN",
  "COPA",
]);

export function isNationalTeamCompetition(
  code: string | null | undefined,
): boolean {
  return code != null && NATIONAL_TEAM_COMPETITION_CODE_SET.has(code);
}

// Cross-competition form blending weights for national team fixture
// analysis. xG weight is 0: non-European qualifying competitions do not
// provide reliable xG data, so blending it in adds noise (calibration scan
// 2026-06-02 on WC 2022: Brier monotonically improves as xG weight
// decreases toward 0).
export const NATIONAL_TEAM_CROSS_COMP_FORM_WEIGHT = 1.0;
export const NATIONAL_TEAM_CROSS_COMP_XG_WEIGHT = 0.0;

// ─── Domestic season rollover ──────────────────────────────────────────────

// Cross-season fallback weights for domestic leagues at the start of a new
// season, while the current-season sample is still thin (Brier scan
// 2026-08-07, 54155 historical domestic fixtures — see ev.constants.ts for
// the full derivation).
export const DOMESTIC_SEASON_ROLLOVER_FORM_WEIGHT = 1.0;
export const DOMESTIC_SEASON_ROLLOVER_XG_WEIGHT = 0.35;

// Below this many current-season matches, a team's teamStats sample is
// considered thin enough to stabilise against the prior-season/cross-comp
// snapshot.
export const DOMESTIC_SEASON_ROLLOVER_MIN_GAMES = 3;

export type ResolveEffectiveTeamStatsInput = {
  competitionCode: string | null;
  primaryStats: TeamStatsInput | null;
  // The most recent teamStats row for this team outside its current
  // competition/season — null if none exists or none was fetched. Fetching
  // it is the caller's job; this function only decides whether/how to use it.
  crossCompStats: TeamStatsInput | null;
  // Ignored for European/national-team competitions (cross-comp blending
  // always applies there when crossCompStats is available, regardless of
  // sample size — matches the live engine).
  gamesPlayedThisSeason: number;
};

// One team's effective stats for a fixture, applying the same policy
// BettingEngineService.analyzeFixture applies: European and national-team
// competitions always blend in cross-comp form when available; domestic
// leagues only blend while the current-season sample is thin
// (< DOMESTIC_SEASON_ROLLOVER_MIN_GAMES). Called once per side (home, away).
export function resolveEffectiveTeamStats(
  input: ResolveEffectiveTeamStatsInput,
): TeamStatsInput | null {
  const {
    competitionCode,
    primaryStats,
    crossCompStats,
    gamesPlayedThisSeason,
  } = input;

  const blendWith = (
    formWeight: number,
    xgWeight: number,
  ): TeamStatsInput | null => {
    if (crossCompStats === null) return primaryStats;
    if (primaryStats === null) return crossCompStats;
    return blendTeamStats({
      primary: primaryStats,
      secondary: crossCompStats,
      formWeight,
      xgWeight,
    });
  };

  if (isEuropeanCompetition(competitionCode)) {
    return blendWith(
      EUROPEAN_CROSS_COMP_FORM_WEIGHT,
      EUROPEAN_CROSS_COMP_XG_WEIGHT,
    );
  }

  if (isNationalTeamCompetition(competitionCode)) {
    return blendWith(
      NATIONAL_TEAM_CROSS_COMP_FORM_WEIGHT,
      NATIONAL_TEAM_CROSS_COMP_XG_WEIGHT,
    );
  }

  if (gamesPlayedThisSeason >= DOMESTIC_SEASON_ROLLOVER_MIN_GAMES) {
    return primaryStats;
  }
  return blendWith(
    DOMESTIC_SEASON_ROLLOVER_FORM_WEIGHT,
    DOMESTIC_SEASON_ROLLOVER_XG_WEIGHT,
  );
}
