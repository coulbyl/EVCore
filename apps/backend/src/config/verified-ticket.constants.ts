export const VERIFIED_TICKET_LIMITS = {
  // « 15 au plus » (07 § 4).
  maxLegs: 15,
  // Bornée par la colonne DECIMAL(14, 3).
  maxTotalOdds: 99_999_999_999,
  // Arrondie à dix décimales en base : en dessous, elle vaudrait 0.
  minChance: 1e-10,
} as const;

// Une vérification par geste du joueur ; au-delà, c'est autre chose.
export const VERIFIED_TICKET_RATE_LIMIT = {
  limit: 30,
  ttlMs: 60_000,
} as const;
