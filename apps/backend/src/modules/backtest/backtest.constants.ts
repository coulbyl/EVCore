import Decimal from 'decimal.js';

export const BACKTEST_CONSTANTS = {
  // Brier score: lower is better. Random baseline for 3-outcome = 0.667.
  // MVP threshold: beat the random classifier (< 0.65).
  // A Poisson rolling-xG model realistically achieves 0.55–0.62 without
  // LLM context or advanced features — targeting 0.25 would require
  // a top-tier professional model.
  BRIER_SCORE_PASS_THRESHOLD: new Decimal('0.65'),
  // Expected Calibration Error: pass if ECE ≤ 5%.
  CALIBRATION_ERROR_PASS_THRESHOLD: new Decimal('0.05'),
  // ROI floor: pass if simulated ROI ≥ -5%.
  ROI_FLOOR_THRESHOLD: new Decimal('-0.05'),
  // Minimum analyzed fixtures to produce a meaningful verdict.
  MIN_FIXTURES_FOR_VALIDATION: 100,
  // Minimum prior TeamStats entries required per team before a fixture is
  // included in Brier score / calibration analysis. Fixtures where either
  // team has fewer than this many prior data points are skipped to avoid
  // cold-start noise (first ~5 matchdays of a season have unreliable stats).
  MIN_PRIOR_TEAM_STATS: 5,
} as const;
