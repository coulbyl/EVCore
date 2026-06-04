export const ML_SEGMENTS = ['EV:ONE_X_TWO', 'CONF:ONE_X_TWO', 'ALL'] as const;
export type MlSegment = (typeof ML_SEGMENTS)[number];

export const ML_ALGORITHMS = ['logistic_regression', 'xgboost'] as const;
export type MlAlgorithm = (typeof ML_ALGORITHMS)[number];

export const ML_MIN_BRIER_IMPROVEMENT = 0.05;
export const ML_RETRAIN_MIN_NEW_BETS = 50;
export const ML_COOLDOWN_DAYS = 7;

export type MlTrainingJobData = {
  segment: MlSegment;
  triggeredBy: string;
};
