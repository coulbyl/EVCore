import type Decimal from 'decimal.js';
import type { Market } from '@evcore/db';
import type {
  DeterministicFeatures,
  HalfTimeFullTimePick,
  computePoissonMarkets,
} from './betting-engine.utils';

export type MatchProbabilities = ReturnType<typeof computePoissonMarkets>;

export type PredictionSource =
  | 'POISSON_MAIN'
  | 'FRI_ELO_REAL'
  | 'FRI_ELO_INTERNAL'
  | 'ODDS_DEVIG';

export type TeamStatsInput = {
  recentForm: unknown;
  xgFor: unknown;
  xgAgainst: unknown;
  homeWinRate: unknown;
  awayWinRate: unknown;
  drawRate: unknown;
  leagueVolatility: unknown;
};

export type MatchupFeatures = {
  recentForm: Decimal;
  xg: Decimal;
  domExtPerf: Decimal;
  leagueVolat: Decimal;
};

export type MatchComputation = {
  deterministicScore: Decimal;
  probabilities: MatchProbabilities;
  lambda: { home: number; away: number };
  features: MatchupFeatures;
};

export type { DeterministicFeatures };

// Full odds snapshot across all supported markets for a given bookmaker+fixture.
export type FullOddsSnapshot = {
  bookmaker: string;
  snapshotAt: Date;
  homeOdds: Decimal;
  drawOdds: Decimal;
  awayOdds: Decimal;
  overUnderOdds: Partial<
    Record<
      'OVER_1_5' | 'UNDER_1_5' | 'OVER' | 'UNDER' | 'OVER_3_5' | 'UNDER_3_5',
      Decimal
    >
  >;
  bttsYesOdds: Decimal | null;
  bttsNoOdds: Decimal | null;
  htftOdds: Partial<Record<HalfTimeFullTimePick, Decimal>>;
  ouHtOdds: Partial<
    Record<'OVER_0_5' | 'UNDER_0_5' | 'OVER_1_5' | 'UNDER_1_5', Decimal>
  >;
  firstHalfWinnerOdds: { home: Decimal; draw: Decimal; away: Decimal } | null;
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
    | 'ev_above_hard_cap'
    | 'ev_above_soft_cap'
    | 'ev_below_threshold'
    | 'filtered_longshot'
    | 'market_suspended'
    | 'odds_above_cap'
    | 'odds_below_floor'
    | 'probability_too_low'
    | 'quality_score_below_threshold'
    | 'under_high_lambda';
};
