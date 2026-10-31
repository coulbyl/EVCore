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
  // Relevé du lundi (2026-10-29) : la semaine passée, lundi à 08:00 UTC,
  // dans la même file. Surchargeable par WEEKLY_STATEMENT_CRON.
  WEEKLY_SCHEDULER_KEY: 'weekly-statement',
  WEEKLY_JOB: 'weekly-statement',
  WEEKLY_CRON: '0 8 * * 1',
  // Résultat d'un coupon suivi, le soir même (2026-10-30, refonte 10 § 3) :
  // toutes les 10 minutes de 20:00 à 00:50 UTC, l'heure d'Abidjan.
  // Surchargeable par FOLLOWED_SETTLED_CRON.
  FOLLOWED_SCHEDULER_KEY: 'followed-settled',
  FOLLOWED_JOB: 'followed-settled',
  FOLLOWED_CRON: '*/10 20-23,0 * * *',
} as const;

/**
 * Le créneau du soir (heures UTC) : rien avant 20 h, rien entre 1 h et 8 h,
 * ce qui se règle après attend la matinée (refonte 10 § 3).
 */
export const FOLLOWED_SETTLED_WINDOW = {
  START_HOUR_UTC: 20,
  /** Exclusive. */
  END_HOUR_UTC: 1,
  /** Joueurs notifiés en parallèle (le pool de connexions vaut 10). */
  CONCURRENCY: 5,
} as const;
