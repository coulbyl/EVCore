// « Résultats » (docs/refonte-ui/08): what each product gave, dated and
// counted, losses included.

/**
 * The products, in the order of « Aujourd'hui », then the LLM combo, then the
 * retired ones (shown to admins only, 08 § 5). A product is told apart by its
 * source and its target band (there is no product column). `launchedOn` is
 * the first day it was published (first `forDate` on the production copy of
 * 2026-10-29): « Tout » never counts before it (08 § 6).
 */
export const RESULTS_PRODUCTS = [
  {
    key: 'FAVOURITE',
    source: 'PRICE_COMPOSER',
    targetOddsMin: 1.1,
    launchedOn: '2026-10-13',
    retired: false,
  },
  {
    key: 'COMBO',
    source: 'ENGINE',
    targetOddsMin: 1.2,
    launchedOn: '2026-10-13',
    retired: false,
  },
  {
    key: 'DOUBLE',
    source: 'PRICE_COMPOSER',
    targetOddsMin: 2,
    launchedOn: '2026-10-29',
    retired: false,
  },
  {
    key: 'HUNTER_BTTS',
    source: 'PRICE_COMPOSER',
    targetOddsMin: 1.45,
    launchedOn: '2026-10-29',
    retired: false,
  },
  {
    key: 'HUNTER_DRAW',
    source: 'PRICE_COMPOSER',
    targetOddsMin: 2.9,
    launchedOn: '2026-10-29',
    retired: false,
  },
  {
    key: 'HUNTER_SCORE',
    source: 'ENGINE',
    targetOddsMin: 6,
    launchedOn: '2026-10-29',
    retired: false,
  },
  {
    key: 'HUNTER_CORNERS',
    source: 'PRICE_COMPOSER',
    targetOddsMin: 1.7,
    launchedOn: '2026-10-30',
    retired: false,
  },
  {
    key: 'COMBO_AI',
    source: 'LLM',
    targetOddsMin: 1.2,
    launchedOn: '2026-10-14',
    retired: false,
  },
  // Retired on 2026-10-29 (the long coupon, the 5–15 price coupon).
  {
    key: 'LONG',
    source: 'ENGINE',
    targetOddsMin: 2.5,
    launchedOn: '2026-10-19',
    retired: true,
  },
  {
    key: 'UNIQUE',
    source: 'PRICE_COMPOSER',
    targetOddsMin: 5,
    launchedOn: '2026-09-17',
    retired: true,
  },
] as const;

/** 30 j · 90 j · Tout; 90 days by default (08 § 1). */
export const RESULTS_PERIODS = ['30', '90', 'all'] as const;
export const RESULTS_DEFAULT_PERIOD = '90';

// Fewer settled days than this: « Trop tôt », no comparison, no francs.
export const RESULTS_TOO_EARLY_DAYS = 10;

// The squares on each line: the last ten days played, whatever the period.
export const RESULTS_FORM_DAYS = 10;

// « En francs, à 1 000 F par jour » (08 § 2).
export const RESULTS_FIXED_STAKE = 1000;
