import Decimal from 'decimal.js';

export const RISK_CONSTANTS = {
  // Alert: ROI < -10% on last 30 non-void bets
  ROI_ALERT_THRESHOLD: new Decimal('-0.10'),
  ROI_ALERT_BET_COUNT: 30,
  // Auto-suspension: ROI < -15% on last 50+ non-void bets
  ROI_SUSPENSION_THRESHOLD: new Decimal('-0.15'),
  ROI_SUSPENSION_BET_COUNT: 50,
  // Brier score alert threshold (lower is better; 0.33 = random baseline)
  BRIER_SCORE_ALERT_THRESHOLD: new Decimal('0.30'),
} as const;
