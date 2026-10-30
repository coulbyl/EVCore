// Player screens served by one aggregate endpoint each
// (docs/refonte-ui/16-performance-et-qualite.md § 3).

// The products of « Aujourd'hui », in screen order (01 § 6, 04 § 4): the
// Favori first, then the Combiné, the Coupon cote 2 and the hunters. The
// LLM combo, the long coupon and the 5–15 coupon are not products of this
// screen (decided 2026-10-29).
export const TODAY_PRODUCTS = [
  'FAVOURITE',
  'COMBO',
  'DOUBLE',
  'HUNTER_BTTS',
  'HUNTER_DRAW',
  'HUNTER_SCORE',
  'HUNTER_CORNERS',
] as const;

// Who takes the hero card (03, 04 § 5): the Favori, then the Combiné when
// it abstains, then the Coupon cote 2, then the first hunter present. Never
// the LLM combo (03 § 3 not revisited).
export const TODAY_HERO_RELAY = [
  'FAVOURITE',
  'COMBO',
  'DOUBLE',
  'HUNTER_BTTS',
  'HUNTER_DRAW',
  'HUNTER_SCORE',
  'HUNTER_CORNERS',
] as const satisfies readonly (typeof TODAY_PRODUCTS)[number][];

// Up to these odds a leg's chance is the engine's calibrated probability;
// above, the market's own frequency without margin (Shin on 1xBet's group):
// at 2.5–4 the engine announces 34 % and lands 29 % (decided 2026-10-29,
// docs/audits/2026-10-29/ACCUMULATEUR.md § 6 and § 10, refonte 06 § 2).
export const ENGINE_CHANCE_MAX_ODDS = 1.8;

// « Forme sur 30 jours » under each product (04 § 1).
export const TODAY_FORM_WINDOW_DAYS = 30;

// A followed coupon from an earlier day stays on « Aujourd'hui » while one
// of its matches is still unsettled (04 § 2: a coupon never disappears while
// it is running). Two days back covers a late kick-off settled the morning
// after, with a day of margin for a slow settlement.
export const TODAY_FOLLOWED_LOOKBACK_DAYS = 2;
