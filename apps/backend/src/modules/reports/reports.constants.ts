import { ML_MIN_BRIER_IMPROVEMENT } from '@modules/ml/ml.constants';
import type { PromotionVerdict, SegmentComparison } from './reports.types';

// Segments whose ML correction is captured per pick (shadow_ml_by_channel on
// ModelRun.features — see betting-engine.service.ts computeShadowMlByChannel).
// Only these can be compared baseline-vs-corrected on realized outcomes.
// Format "CHANNEL:MARKET" — both parts are needed to disambiguate rows sharing
// a market across channels (e.g. VALUE:OVER_UNDER vs GOALS:OVER_UNDER).
// Canal names renamed 2026-07 (EV→VALUE, CONF→DOMINANT) — see docs/ml-worker-sync.md.
//
// Note on ROI (2026-07-24, extended beyond VALUE): only VALUE has a
// well-defined "would this still have been selected" replay (EV_THRESHOLD
// gate on the corrected probability). DOMINANT/DRAW/BTTS/GOALS select by a
// per-league probability threshold, not by EV — replaying their policy would
// need each channel's own threshold config, not a copy-paste of VALUE's EV
// gate (flagged in docs/ml-worker-sync.md as a real design decision, not
// done here). For non-VALUE segments `correctedRoi` is left `null`
// (comparable to "no pick cleared the policy gate") — Brier comparison alone
// still gives a real, honest verdict ceiling (WATCH at most, never a false GO).
export const SHADOW_CAPTURED_SEGMENTS = [
  'VALUE:ONE_X_TWO',
  'VALUE:OVER_UNDER',
  'VALUE:BTTS',
  'DOMINANT:ONE_X_TWO',
  'DRAW:ONE_X_TWO',
  'BTTS:BTTS',
  'GOALS:OVER_UNDER',
] as const;

// Segments with an active model but no per-pick shadow correction wired at
// all (kept for a future channel not yet in ML_SHADOW_CHANNELS) — currently
// empty, every live-inference channel now gets at least a Brier comparison.
export const META_ONLY_SEGMENTS: readonly string[] = [];

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
