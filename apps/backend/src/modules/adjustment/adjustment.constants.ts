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
 */
export const CALIBRATION_TRIGGER_THRESHOLD = 0.25;

/** Brier score target below which no adjustment is needed. */
export const BRIER_TARGET = 0.2;

/** Minimum number of days between two consecutive auto-apply cycles. */
export const MIN_DAYS_BETWEEN_APPLICATIONS = 7;
