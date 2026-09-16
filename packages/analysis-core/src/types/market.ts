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
  RESULT_TOTAL_GOALS: "RESULT_TOTAL_GOALS",
  RESULT_BTTS: "RESULT_BTTS",
  // Handicap asiatique, plein match et mi-temps. Ajoutés 2026-09-15 (plan de
  // rentabilité, chantier A) : c'est le marché le moins taxé du carnet —
  // 4,11 % de marge Pinnacle sur 40 rencontres contre 4,52 % sur ONE_X_TWO —
  // et il n'était pas collecté. Seul marché dont la ligne fait partie de
  // l'identité du prix, d'où la colonne `line` sur OddsSnapshot.
  ASIAN_HANDICAP: "ASIAN_HANDICAP",
  ASIAN_HANDICAP_HT: "ASIAN_HANDICAP_HT",
  // Marchés à ligne ajoutés 2026-09-15 (chantier A, A-10 à A-12). Les lignes
  // de corners sont parfois ENTIÈRES (« Over 9 », « Over 4 ») : elles vivent
  // dans la colonne `line`, jamais dans un suffixe de `pick`.
  OVER_UNDER_2H: "OVER_UNDER_2H",
  CORNERS: "CORNERS",
  CORNERS_HT: "CORNERS_HT",
  CARDS: "CARDS",
  // Marchés à issues fixes (A-13 à A-15), sans ligne.
  ODD_EVEN: "ODD_EVEN",
  ODD_EVEN_HT: "ODD_EVEN_HT",
  HIGHEST_SCORING_HALF: "HIGHEST_SCORING_HALF",
  TEAM_TO_SCORE_FIRST: "TEAM_TO_SCORE_FIRST",
} as const;

export type Market = (typeof Market)[keyof typeof Market];
