import type Decimal from "decimal.js";
import type { Market } from "../types";
import type {
  HalfTimeFullTimePick,
  computePoissonMarkets,
} from "../probability";

// Derived market probabilities for a single fixture (Poisson + devig blend).
export type MatchProbabilities = ReturnType<typeof computePoissonMarkets>;

export type TeamTotalOddsMap = Partial<
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

// Full odds snapshot across all supported markets for a given bookmaker+fixture.
export type FullOddsSnapshot = {
  bookmaker: string;
  snapshotAt: Date;
  homeOdds: Decimal;
  drawOdds: Decimal;
  awayOdds: Decimal;
  overUnderOdds: Partial<
    Record<
      | "OVER_1_5"
      | "UNDER_1_5"
      | "OVER"
      | "UNDER"
      | "OVER_3_5"
      | "UNDER_3_5"
      | "OVER_4_5"
      | "UNDER_4_5",
      Decimal
    >
  >;
  bttsYesOdds: Decimal | null;
  bttsNoOdds: Decimal | null;
  htftOdds: Partial<Record<HalfTimeFullTimePick, Decimal>>;
  ouHtOdds: Partial<
    Record<"OVER_0_5" | "UNDER_0_5" | "OVER_1_5" | "UNDER_1_5", Decimal>
  >;
  firstHalfWinnerOdds: { home: Decimal; draw: Decimal; away: Decimal } | null;
  doubleChanceOdds: { "1X": Decimal; X2: Decimal; "12": Decimal | null } | null;
  // Full-time exact score: scoreline "H:A" → odds. Observation-only market;
  // optional so existing snapshot builders/tests don't need to set it.
  correctScoreOdds?: Partial<Record<string, Decimal>>;
  drawNoBetOdds: { home: Decimal; away: Decimal } | null;
  teamTotalHomeOdds: TeamTotalOddsMap;
  teamTotalAwayOdds: TeamTotalOddsMap;
  cleanSheetHomeOdds: { yes: Decimal; no: Decimal } | null;
  cleanSheetAwayOdds: { yes: Decimal; no: Decimal } | null;
  winToNilHomeOdds: { yes: Decimal; no: Decimal } | null;
  winToNilAwayOdds: { yes: Decimal; no: Decimal } | null;
  winEitherHalfOdds: { home: Decimal; away: Decimal } | null;
  // Pre-combined bookmaker markets (result × goals line / result × BTTS) —
  // a genuine joint price, not a synthetic combo.
  resultTotalGoalsOdds: Partial<
    Record<
      `${"HOME" | "DRAW" | "AWAY"}_${"OVER" | "UNDER"}_${"1_5" | "2_5" | "3_5" | "4_5"}`,
      Decimal
    >
  >;
  resultBttsOdds: Partial<
    Record<`${"HOME" | "DRAW" | "AWAY"}_${"YES" | "NO"}`, Decimal>
  >;
};

// Best pick identified by the betting engine across all markets (single or combo).
export type ViablePick = {
  market: Market;
  pick: string;
  comboMarket?: Market;
  comboPick?: string;
  probability: Decimal;
  odds: Decimal;
  ev: Decimal;
  qualityScore: Decimal; // ev × deterministicScore
  isCombo: boolean;
};

export type EvaluatedPick = ViablePick & {
  rejectionReason?:
    | "ev_above_hard_cap"
    | "ev_above_soft_cap"
    | "ev_below_threshold"
    | "filtered_longshot"
    | "market_suspended"
    | "odds_above_cap"
    | "odds_below_floor"
    | "probability_too_low"
    | "quality_score_below_threshold"
    | "under_high_lambda";
};
