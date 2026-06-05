export const ML_SEGMENTS = [
  'ALL',
  'EV:ONE_X_TWO',
  'EV:OVER_UNDER',
  'EV:BTTS',
  'CONF:ONE_X_TWO',
  'DRAW:ONE_X_TWO',
  'BTTS:BTTS',
] as const;
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

export type MlTrainingJobStatus = {
  id: string;
  name: string;
  state: string;
  failedReason: string | null;
  returnvalue: unknown;
  attemptsMade: number;
  processedOn: number | null;
  finishedOn: number | null;
};

export const ML_TRAINING_JOB_OPTIONS = {
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
} as const;

export const ML_BACKFILL_JOB_OPTIONS = {
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
} as const;
