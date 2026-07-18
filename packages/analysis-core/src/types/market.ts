// Betting markets supported by the engine.
//
// SOURCE OF TRUTH for the `Market` domain enum. The Prisma schema declares an
// enum with identical string values; a compile-time + runtime conformance test
// (apps/backend `domain-enums.conformance.spec.ts`) fails the build if the two
// ever diverge. analysis-core must never import this enum from Prisma — the
// domain owns it, the database persists it.
export const Market = {
  ONE_X_TWO: "ONE_X_TWO",
  OVER_UNDER: "OVER_UNDER",
  BTTS: "BTTS",
  DOUBLE_CHANCE: "DOUBLE_CHANCE",
  HALF_TIME_FULL_TIME: "HALF_TIME_FULL_TIME",
  OVER_UNDER_HT: "OVER_UNDER_HT",
  FIRST_HALF_WINNER: "FIRST_HALF_WINNER",
  CORRECT_SCORE: "CORRECT_SCORE",
  DRAW_NO_BET: "DRAW_NO_BET",
  TEAM_TOTAL_HOME: "TEAM_TOTAL_HOME",
  TEAM_TOTAL_AWAY: "TEAM_TOTAL_AWAY",
  CLEAN_SHEET_HOME: "CLEAN_SHEET_HOME",
  CLEAN_SHEET_AWAY: "CLEAN_SHEET_AWAY",
  WIN_TO_NIL_HOME: "WIN_TO_NIL_HOME",
  WIN_TO_NIL_AWAY: "WIN_TO_NIL_AWAY",
  TO_WIN_EITHER_HALF: "TO_WIN_EITHER_HALF",
} as const;

export type Market = (typeof Market)[keyof typeof Market];
