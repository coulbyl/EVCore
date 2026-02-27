import type Decimal from 'decimal.js';
import type {
  DeterministicFeatures,
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
