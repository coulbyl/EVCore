import Decimal from 'decimal.js';

export const BACKTEST_CONSTANTS = {
  // Brier score: lower is better. Random baseline for 3-outcome = 0.667.
  // Pass if brierScore ≤ 0.25.
  BRIER_SCORE_PASS_THRESHOLD: new Decimal('0.25'),
  // Expected Calibration Error: pass if ECE ≤ 5%.
  CALIBRATION_ERROR_PASS_THRESHOLD: new Decimal('0.05'),
  // ROI floor: pass if simulated ROI ≥ -5%.
  ROI_FLOOR_THRESHOLD: new Decimal('-0.05'),
  // Minimum analyzed fixtures to produce a meaningful verdict.
  MIN_FIXTURES_FOR_VALIDATION: 100,
} as const;
