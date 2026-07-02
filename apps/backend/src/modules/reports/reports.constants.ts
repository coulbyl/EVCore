import { ML_MIN_BRIER_IMPROVEMENT } from '@modules/ml/ml.constants';
import type { PromotionVerdict, SegmentComparison } from './reports.types';

// Segments whose ML correction is captured per pick (shadow_ml_corrected_p on
// the VALUE channel's ModelRun). Only these can be compared baseline-vs-corrected
// on realized outcomes. Keys mirror channel_selection.market.
// Canal names renamed 2026-07 (EV→VALUE, CONF→DOMINANT) — see docs/ml-worker-sync.md.
export const SHADOW_CAPTURED_SEGMENTS = [
  'VALUE:ONE_X_TWO',
  'VALUE:OVER_UNDER',
  'VALUE:BTTS',
] as const;

// Other channels now get shadow ML correction too (shadow_ml_by_channel on
// ModelRun.features — see betting-engine.service.ts computeShadowMlByChannel),
// but ReportsRepository only reads the VALUE channel today, so their per-pick
// Brier/ROI comparison isn't wired up here yet — meta-metrics only for now.
export const META_ONLY_SEGMENTS = [
  'DOMINANT:ONE_X_TWO',
  'DRAW:ONE_X_TWO',
  'BTTS:BTTS',
] as const;

// Minimum settled, comparable picks before a verdict is allowed — mirrors the
// engine's 50-bet calibration floor. Below this, the verdict is INSUFFICIENT.
export const PROMOTION_MIN_SAMPLE = 50;

// Versions created before this date use the pre-fix roiShadow definition
// (ROI of the dataset, not the model policy) — flagged as not comparable.
export const ROI_SHADOW_FIX_DATE = new Date('2026-06-11T00:00:00.000Z');

export const PROMOTION_RULE_TEXT = `GO si ΔBrier ≥ +${(ML_MIN_BRIER_IMPROVEMENT * 100).toFixed(0)}% ET ROI corrigé ≥ baseline ET n ≥ ${PROMOTION_MIN_SAMPLE} settled`;

// Pure verdict rule — no IO. Promote only when the correction improves
// calibration meaningfully AND does not lose ROI versus the baseline policy.
export function computeVerdict(c: SegmentComparison): {
  verdict: PromotionVerdict;
  brierImprovement: number | null;
} {
  if (c.sampleSize < PROMOTION_MIN_SAMPLE) {
    return { verdict: 'INSUFFICIENT', brierImprovement: null };
  }
  if (c.baselineBrier <= 0) {
    return { verdict: 'INSUFFICIENT', brierImprovement: null };
  }

  const brierImprovement =
    (c.baselineBrier - c.correctedBrier) / c.baselineBrier;

  // Corrected calibration strictly worse than baseline → never promote.
  if (c.correctedBrier > c.baselineBrier) {
    return { verdict: 'NO_GO', brierImprovement };
  }

  const roiOk = c.correctedRoi !== null && c.correctedRoi >= c.baselineRoi;
  if (brierImprovement >= ML_MIN_BRIER_IMPROVEMENT && roiOk) {
    return { verdict: 'GO', brierImprovement };
  }

  return { verdict: 'WATCH', brierImprovement };
}
