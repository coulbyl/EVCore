// Canal names mirror the `StrategyChannel` Prisma enum (EV→VALUE, CONF→DOMINANT
// renamed 2026-07; see docs/ml-worker-sync.md). Each entry needs >=50 settled
// channel_selection rows to actually train (ML_RETRAIN_MIN_NEW_BETS).
// CLEAN_SHEET/TEAM_TOTAL/WIN_EITHER_HALF added 2026-07-24 (real settled
// volume + Pinnacle/Bet365 odds coverage confirmed — see
// apps/ml-worker/src/data/extract.py). CORRECT_SCORE is excluded: de-vigging
// a ~50-scoreline market needs different logic than the two/three-way
// markets extract.py handles — deferred.
export const ML_SEGMENTS = [
  'ALL',
  'VALUE:ONE_X_TWO',
  'VALUE:OVER_UNDER',
  'VALUE:BTTS',
  'VALUE:FIRST_HALF_WINNER',
  'SAFE:ONE_X_TWO',
  'SAFE:OVER_UNDER',
  'DOMINANT:ONE_X_TWO',
  'BTTS:BTTS',
  'DRAW:ONE_X_TWO',
  'GOALS:OVER_UNDER',
  'CLEAN_SHEET:CLEAN_SHEET_HOME',
  'CLEAN_SHEET:CLEAN_SHEET_AWAY',
  'TEAM_TOTAL:TEAM_TOTAL_HOME',
  'TEAM_TOTAL:TEAM_TOTAL_AWAY',
  'WIN_EITHER_HALF:TO_WIN_EITHER_HALF',
] as const;
export type MlSegment = (typeof ML_SEGMENTS)[number];

// Channels wired for live shadow inference (predictShadowCorrection). SAFE
// is trained (ML_SEGMENTS) but intentionally excluded here — see
// docs/ml-worker-sync.md.
export const ML_SHADOW_CHANNELS = [
  'VALUE',
  'DOMINANT',
  'BTTS',
  'DRAW',
  'GOALS',
  'CLEAN_SHEET',
  'TEAM_TOTAL',
  'WIN_EITHER_HALF',
] as const;
export type MlShadowChannel = (typeof ML_SHADOW_CHANNELS)[number];

export type MlShadowCorrection = { correctedP: number; edgeDelta: number };
export type ShadowMlByChannel = Partial<
  Record<MlShadowChannel, MlShadowCorrection>
>;

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

export const ML_CRON_SCHEDULES = {
  RETRAIN_CHECK: '0 3 * * 1', // 03:00 UTC every Monday
  CATCH_UP_SWITCH: '0 * * * *', // every hour — catches models trained while QueueEvents was offline
} as const;

export const ML_SCHEDULER_KEYS = {
  RETRAIN_CHECK: 'cron:ml-retrain-check',
  CATCH_UP_SWITCH: 'cron:ml-catch-up-switch',
} as const;
