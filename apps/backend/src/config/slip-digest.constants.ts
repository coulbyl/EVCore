/**
 * Résumé quotidien des coupons déclarés réglés depuis la veille (décision du
 * 2026-10-28) : une notification par joueur, le matin plutôt qu'à minuit,
 * quand les matchs finissent tard et qu'on cherche à se refaire en direct.
 */
export const SLIP_DIGEST = {
  QUEUE: 'slip-digest',
  SCHEDULER_KEY: 'slip-digest-daily',
  // 08:00 UTC : 8 h à Abidjan et Dakar, 9 h à Douala. Surchargeable par
  // SLIP_DIGEST_CRON.
  CRON: '0 8 * * *',
  // Un coupon réglé en retard (fournisseur lent, match reporté au lendemain)
  // entre dans le résumé du jour où il est réglé, s'il s'est joué dans les
  // 7 derniers jours ; chaque coupon n'est annoncé réglé qu'une fois.
  LOOKBACK_DAYS: 7,
} as const;
