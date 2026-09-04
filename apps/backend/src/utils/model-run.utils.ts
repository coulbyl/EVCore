// ModelRun.features.* readers now live in @evcore/analysis-core (shared with
// apps/vantage-worker's own coupon-pool query, see docs/vantage-centric-
// redesign-2026-09-01.md §9bis). Re-exported here so existing
// './utils/model-run.utils' imports across the module keep resolving unchanged.
export {
  computeDataCoverage,
  extractEvaContextFromFeatures,
  extractModelRunFeatureDiagnostics,
  hasCalibrationAlert,
  readShadowConflict,
} from '@evcore/analysis-core';
export type {
  EvaFeaturesContext,
  EvaluatedPickSnapshot,
  EvaPickFromFeature,
  ModelRunFactors,
  ModelRunFeatureDiagnostics,
  OffensiveBalanceFromFeature,
  PickSnapshot,
} from '@evcore/analysis-core';
