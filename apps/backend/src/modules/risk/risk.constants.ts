import Decimal from 'decimal.js';

export const RISK_CONSTANTS = {
  // The sample: the engine's settled legs (channel_selection_deduped) over
  // a trailing window. "Last 50 bets" was the original rule; on the real
  // sample it is noise — it would spare RESULT_BTTS (+22 % on its last 50,
  // −26 % ± 3 over 90 days) and suspend TEAM_TOTAL_AWAY (−5 % ± 1.4).
  ROI_WINDOW_DAYS: 90,
  // Observation-only channels: no bet, no display since 2026-09-03.
  ROI_EXCLUDED_CHANNELS: ['VALUE', 'SAFE'],
  // Alert: ROI < -10% on 30+ settled legs, at most once per market per week
  ROI_ALERT_THRESHOLD: new Decimal('-0.10'),
  ROI_ALERT_BET_COUNT: 30,
  ROI_ALERT_COOLDOWN_DAYS: 7,
  // Auto-suspension: ROI < -15% on 50+ settled legs, and the loss must be
  // real — the 95 % upper bound of the ROI (mean + z × standard error)
  // below zero — so a market is never suspended on a bad week alone.
  ROI_SUSPENSION_THRESHOLD: new Decimal('-0.15'),
  ROI_SUSPENSION_BET_COUNT: 50,
  ROI_SUSPENSION_Z: new Decimal('1.96'),
  // Brier score alert threshold (lower is better; 0.33 = random baseline)
  BRIER_SCORE_ALERT_THRESHOLD: new Decimal('0.30'),
} as const;
