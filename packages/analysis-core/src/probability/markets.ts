import Decimal from "decimal.js";

export type ThreeWayProba = {
  home: Decimal;
  draw: Decimal;
  away: Decimal;
};

export type DerivedMarketsProba = {
  over15: Decimal;
  under15: Decimal;
  over25: Decimal;
  under25: Decimal;
  over35: Decimal;
  under35: Decimal;
  over45: Decimal;
  under45: Decimal;
  bttsYes: Decimal;
  bttsNo: Decimal;
  dc1X: Decimal;
  dcX2: Decimal;
  dc12: Decimal;
  // Draw No Bet — draw mass excluded and renormalized, distinct from the
  // unnormalized dc1X/dc12 sums above (those still cover a draw refund
  // scenario as part of a two-way payout, DNB does not).
  dnbHome: Decimal;
  dnbAway: Decimal;
  teamTotalHome: TeamTotalProba;
  teamTotalAway: TeamTotalProba;
  // Full-time, closed-form from the marginal goal distributions — the
  // opposing side fails to score.
  cleanSheetHome: Decimal;
  cleanSheetAway: Decimal;
  winToNilHome: Decimal;
  winToNilAway: Decimal;
  htft: Record<HalfTimeFullTimePick, Decimal>;
  // First-half derived markets
  ouHT: Partial<
    Record<"OVER_0_5" | "UNDER_0_5" | "OVER_1_5" | "UNDER_1_5", Decimal>
  >;
  firstHalfWinner: ThreeWayProba;
  secondHalfWinner: ThreeWayProba;
  // Inclusion-exclusion over firstHalfWinner/secondHalfWinner (assumed
  // independent). home+away is NOT bounded by 1 like dc1X/dcX2/dc12 above —
  // the two events overlap (e.g. home wins H1 while away wins H2 makes both
  // "wins either half" true simultaneously), so this isn't a two-way split.
  winEitherHalfHome: Decimal;
  winEitherHalfAway: Decimal;
};

export type TeamTotalProba = Partial<
  Record<
    | "OVER_0_5"
    | "UNDER_0_5"
    | "OVER_1_5"
    | "UNDER_1_5"
    | "OVER_2_5"
    | "UNDER_2_5"
    | "OVER_3_5"
    | "UNDER_3_5"
    | "OVER_4_5"
    | "UNDER_4_5"
    | "OVER_5_5"
    | "UNDER_5_5"
    | "OVER_6_5"
    | "UNDER_6_5",
    Decimal
  >
>;

export type FirstHalfMarkets = {
  htft: Record<HalfTimeFullTimePick, Decimal>;
  ouHT: Partial<
    Record<"OVER_0_5" | "UNDER_0_5" | "OVER_1_5" | "UNDER_1_5", Decimal>
  >;
  firstHalfWinner: ThreeWayProba;
  secondHalfWinner: ThreeWayProba;
};

export const HALF_TIME_FULL_TIME_PICKS = [
  "HOME_HOME",
  "HOME_DRAW",
  "HOME_AWAY",
  "DRAW_HOME",
  "DRAW_DRAW",
  "DRAW_AWAY",
  "AWAY_HOME",
  "AWAY_DRAW",
  "AWAY_AWAY",
] as const;
export type HalfTimeFullTimePick = (typeof HALF_TIME_FULL_TIME_PICKS)[number];

export function outcomeFromScores(
  homeScore: number,
  awayScore: number,
): "HOME" | "DRAW" | "AWAY" {
  if (homeScore > awayScore) return "HOME";
  if (homeScore < awayScore) return "AWAY";
  return "DRAW";
}

export function isHalfTimeFullTimePick(
  value: string,
): value is HalfTimeFullTimePick {
  return (HALF_TIME_FULL_TIME_PICKS as readonly string[]).includes(value);
}
