import type Decimal from 'decimal.js';
import type { Market } from '@evcore/db';
import type {
  DeterministicFeatures,
  HalfTimeFullTimePick,
  computePoissonMarkets,
} from './betting-engine.utils';

export type MatchProbabilities = ReturnType<typeof computePoissonMarkets>;

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
  overOdds: Decimal | null;
  underOdds: Decimal | null;
  bttsYesOdds: Decimal | null;
  bttsNoOdds: Decimal | null;
  htftOdds: Partial<Record<HalfTimeFullTimePick, Decimal>>;
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
    | 'ev_below_threshold'
    | 'filtered_longshot'
    | 'market_suspended'
    | 'odds_above_cap'
    | 'odds_below_floor'
    | 'probability_too_low'
    | 'quality_score_below_threshold';
};
