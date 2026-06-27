import type Decimal from 'decimal.js';
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchProbabilities,
  ViablePick,
} from '@evcore/analysis-core';
import type { DeterministicFeatures } from './betting-engine.utils';

// Re-exported from the pure core (@evcore/analysis-core/selection) so existing
// imports keep resolving against './betting-engine.types'.
export type { EvaluatedPick, FullOddsSnapshot, MatchProbabilities, ViablePick };

export type PredictionSource =
  | 'POISSON_MAIN'
  | 'FRI_ELO_REAL'
  | 'FRI_ELO_POISSON'
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
