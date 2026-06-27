import Decimal from 'decimal.js';

export type DeterministicFeatures = {
  recentForm: Decimal.Value;
  xg: Decimal.Value;
  domExtPerf: Decimal.Value;
  leagueVolat: Decimal.Value;
};

export type FeatureWeights = {
  recentForm: Decimal.Value;
  xg: Decimal.Value;
  domExtPerf: Decimal.Value;
  leagueVolat: Decimal.Value;
};

// Cold-start weighting of the deterministic score: Form 30% / xG 30% /
// Home-Away 25% / League volatility 15%. The learning loop may override these
// per market via an applied AdjustmentProposal; this const is the default.
export const FEATURE_WEIGHTS = {
  recentForm: new Decimal('0.30'),
  xg: new Decimal('0.30'),
  domExtPerf: new Decimal('0.25'),
  leagueVolat: new Decimal('0.15'),
} as const;

export function calculateDeterministicScore(
  features: DeterministicFeatures,
  weights: FeatureWeights = FEATURE_WEIGHTS,
): Decimal {
  return new Decimal(features.recentForm)
    .times(weights.recentForm)
    .plus(new Decimal(features.xg).times(weights.xg))
    .plus(new Decimal(features.domExtPerf).times(weights.domExtPerf))
    .plus(new Decimal(features.leagueVolat).times(weights.leagueVolat));
}
