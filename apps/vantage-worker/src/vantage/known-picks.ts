import { Market } from "@evcore/analysis-core";

// Defense in depth, on top of the Market enum check in response-schema.ts:
// Zod only proves "this string is a value inside Market" — it says nothing
// about whether the *pick* string is a real pick for *that* market. Without
// this second check, a hallucinated pick like `{ market: "BTTS", pick: "Home
// wins comfortably" }` would sail through validation and reach the database.
//
// This is a defensive catalog, not the source of truth — the analysis-core
// strategies are (see packages/analysis-core/src/probability/markets.ts). If
// a new pick shape is added there, mirror it here too.
const FIXED_PICKS: Partial<Record<string, readonly string[]>> = {
  [Market.ONE_X_TWO]: ["HOME", "DRAW", "AWAY"],
  [Market.DOUBLE_CHANCE]: ["1X", "X2", "12"],
  [Market.BTTS]: ["YES", "NO"],
  [Market.DRAW_NO_BET]: ["HOME", "AWAY"],
  [Market.FIRST_HALF_WINNER]: ["HOME", "DRAW", "AWAY"],
  [Market.TO_WIN_EITHER_HALF]: ["HOME", "AWAY"],
  [Market.CLEAN_SHEET_HOME]: ["YES", "NO"],
  [Market.CLEAN_SHEET_AWAY]: ["YES", "NO"],
  [Market.WIN_TO_NIL_HOME]: ["YES", "NO"],
  [Market.WIN_TO_NIL_AWAY]: ["YES", "NO"],
  [Market.OVER_UNDER_HT]: ["OVER_0_5", "UNDER_0_5", "OVER_1_5", "UNDER_1_5"],
  [Market.OVER_UNDER]: [
    "OVER",
    "UNDER",
    "OVER_1_5",
    "UNDER_1_5",
    "OVER_2_5",
    "UNDER_2_5",
    "OVER_3_5",
    "UNDER_3_5",
    "OVER_4_5",
    "UNDER_4_5",
  ],
  [Market.TEAM_TOTAL_HOME]: ["OVER_0_5", "UNDER_0_5", "OVER_1_5", "UNDER_1_5"],
  [Market.TEAM_TOTAL_AWAY]: ["OVER_0_5", "UNDER_0_5", "OVER_1_5", "UNDER_1_5"],
  [Market.HALF_TIME_FULL_TIME]: [
    "HOME_HOME",
    "HOME_DRAW",
    "HOME_AWAY",
    "DRAW_HOME",
    "DRAW_DRAW",
    "DRAW_AWAY",
    "AWAY_HOME",
    "AWAY_DRAW",
    "AWAY_AWAY",
  ],
};

// Markets whose pick space is combinatorial (side × goals line, or an exact
// scoreline) — validated by pattern instead of a fixed list.
const PATTERN_PICKS: Partial<Record<string, RegExp>> = {
  [Market.CORRECT_SCORE]: /^\d{1,2}:\d{1,2}$/,
  [Market.RESULT_BTTS]: /^(HOME|DRAW|AWAY)_(YES|NO)$/,
  [Market.RESULT_TOTAL_GOALS]: /^(HOME|DRAW|AWAY)_(OVER|UNDER)_\d_5$/,
};

export function isValidPickForMarket(market: string, pick: string): boolean {
  const fixed = FIXED_PICKS[market];
  if (fixed) return (fixed as readonly string[]).includes(pick);

  const pattern = PATTERN_PICKS[market];
  if (pattern) return pattern.test(pick);

  return false;
}
