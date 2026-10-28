/**
 * Résumé quotidien des coupons déclarés réglés la veille (décision du
 * 2026-10-28) : une notification par joueur, le matin plutôt qu'à minuit,
 * quand les matchs finissent tard et qu'on cherche à se refaire en direct.
 */
export const SLIP_DIGEST = {
  QUEUE: 'slip-digest',
  SCHEDULER_KEY: 'slip-digest-daily',
  // 08:00 UTC : 8 h à Abidjan et Dakar, 9 h à Douala. Surchargeable par
  // SLIP_DIGEST_CRON.
  CRON: '0 8 * * *',
} as const;
