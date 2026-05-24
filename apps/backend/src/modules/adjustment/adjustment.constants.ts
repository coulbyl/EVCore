/**
 * Constants for the learning loop / AdjustmentProposal system.
 * All thresholds are defined here — never hardcoded inline.
 */

/** Minimum number of settled bets on a market before triggering calibration. */
export const MIN_BET_COUNT = 50;

/** Maximum weight change allowed per weekly cycle (absolute delta per feature). */
export const MAX_WEIGHT_CHANGE = 0.05;

/**
 * Brier score above which recalibration is triggered.
 * Perfect calibration → 0, random model → 0.25, always-wrong → 1.
 * Lowered 0.25 → 0.20 (2026-05-24): live ONE_X_TWO sits at 0.2239 with mean
 * error +0.1446 (systematic over-confidence). 0.25 was never reachable in practice.
 */
export const CALIBRATION_TRIGGER_THRESHOLD = 0.2;

/** Brier score target below which no adjustment is needed. */
export const BRIER_TARGET = 0.2;

/** Minimum number of days between two consecutive auto-apply cycles. */
export const MIN_DAYS_BETWEEN_APPLICATIONS = 7;
