// Verdict for promoting a segment's ML correction out of shadow mode.
// GO     — correction beats baseline on calibration AND policy ROI, enough sample.
// WATCH  — right direction but fragile (below the improvement bar) — keep observing.
// NO_GO  — corrected calibration is worse than baseline — do not promote.
// INSUFFICIENT — not enough settled, comparable picks to decide.
// META_ONLY — channel has no per-pick shadow correction (prediction channels);
//             only training-time metrics from ml_model_version are available.
export type PromotionVerdict =
  | 'GO'
  | 'WATCH'
  | 'NO_GO'
  | 'INSUFFICIENT'
  | 'META_ONLY';

export type PromotionWindow = 'P7D' | 'P30D' | 'P90D' | 'SINCE_ACTIVATION';

// Inputs to the deterministic verdict rule — kept separate from DB/IO so the
// rule is pure and unit-testable.
export type SegmentComparison = {
  sampleSize: number;
  baselineBrier: number;
  correctedBrier: number;
  baselineRoi: number;
  // null when no corrected pick clears the EV policy gate in the window.
  correctedRoi: number | null;
};

export type ActiveModelMeta = {
  versionId: string;
  algorithm: string;
  activatedAt: string | null;
  brierScore: number | null;
  roiShadow: number | null;
  // True for versions trained before the 2026-06-11 roiShadow definition fix —
  // their roiShadow is not comparable to later versions.
  roiShadowLegacy: boolean;
};

export type SegmentReportRow = {
  segment: string;
  verdict: PromotionVerdict;
  comparison: SegmentComparison | null;
  // Relative Brier improvement (baseline - corrected) / baseline; null if N/A.
  brierImprovement: number | null;
  activeModel: ActiveModelMeta | null;
};

export type MlPromotionReport = {
  window: PromotionWindow;
  from: string;
  to: string;
  // Freshness: most recent settled bet timestamp used in the aggregation.
  asOf: string | null;
  rule: string;
  segments: SegmentReportRow[];
};
