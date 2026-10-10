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
/** Book et heure de mise à jour du prix retenu pour un (marché, choix). */
export type QuoteSource = {
  bookmaker: string;
  snapshotAt: Date;
  /**
   * Marge payée sur ce choix (chantier E, E-5) : surcote du groupe d'issues
   * complet chez CE book, `Σ 1/cote / total − 1`, à l'instant du relevé.
   * `null` quand le book ne cote pas le groupe complet, ou que le marché n'a
   * pas de partition exclusive (`outcomeGroup`).
   */
  margin?: Decimal | null;
  /** Plus petite marge offerte sur ce groupe par un book du relevé, même règle. */
  bestMargin?: Decimal | null;
};

/** Clé de `FullOddsSnapshot.sources` : `${market}:${pick}`. */
export function quoteKey(market: Market, pick: string): string {
  return `${market}:${pick}`;
}

export type FullOddsSnapshot = {
  // Book et heure du triplet 1X2 retenu. Les autres marchés sont résolus
  // book par book, voire choix par choix : leur provenance est dans
  // `sources`, jamais ici.
  bookmaker: string;
  snapshotAt: Date;
  // Provenance par (marché, choix), clé `quoteKey(market, pick)`. Sans elle,
  // une sélection ne peut pas être rapprochée de la clôture du MÊME book, et
  // le CLV compare deux maisons relevées à deux heures (chantier E). Optionnel
  // pour les relevés construits à la main (tests, triplets 1X2 seuls) :
  // `quoteSourceFor` retombe alors sur le triplet pour le 1X2, et sur null
  // ailleurs.
  sources?: Readonly<Record<string, QuoteSource>>;
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

// Best pick identified by the betting engine across all markets.
export type ViablePick = {
  market: Market;
  pick: string;
  probability: Decimal;
  odds: Decimal;
  ev: Decimal;
  qualityScore: Decimal; // ev × deterministicScore
  // Provenance du prix, quand le relevé la connaît (voir QuoteSource).
  oddsBookmaker?: string;
  oddsSnapshotAt?: Date;
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
