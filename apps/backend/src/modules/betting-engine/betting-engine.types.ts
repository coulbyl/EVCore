import type Decimal from 'decimal.js';
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchProbabilities,
  MatchupFeatures,
  PredictionSource,
  TeamStatsInput,
  ViablePick,
} from '@evcore/analysis-core';
import type { DeterministicFeatures } from './betting-engine.utils';

// Re-exported from the pure core so existing imports against
// './betting-engine.types' keep resolving unchanged.
export type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchProbabilities,
  MatchupFeatures,
  PredictionSource,
  TeamStatsInput,
  ViablePick,
};

export type MatchComputation = {
  deterministicScore: Decimal;
  probabilities: MatchProbabilities;
  // The unadjusted Poisson output, before the empirical 1X2 blend and O/U
  // shrinkage layers — exported alongside `probabilities` so the adjustment
  // itself is auditable (a fixture where the two diverge sharply means the
  // published edge lives entirely in the adjustment layer, not the model).
  rawProbabilities: MatchProbabilities;
  lambda: { home: number; away: number };
  features: MatchupFeatures;
};

export type { DeterministicFeatures };
