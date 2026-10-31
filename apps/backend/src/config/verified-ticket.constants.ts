export const VERIFIED_TICKET_LIMITS = {
  // « 15 au plus » (07 § 4).
  maxLegs: 15,
  // Bornée par la colonne DECIMAL(14, 3).
  maxTotalOdds: 99_999_999_999,
  // Arrondie à dix décimales en base : en dessous, elle vaudrait 0.
  minChance: 1e-10,
} as const;
