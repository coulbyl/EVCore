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

// « Matchs » (docs/refonte-ui/06 § 1): a day reaches 224 matches (max over
// 60 days on the production copy, mean 64), read 60 at a time.
export const MATCHES_PAGE_SIZE = 60;

// Within one kick-off time, the big competitions first (06 § 1), then the
// others by name.
export const MATCHES_LEAGUE_PRIORITY = [
  'UCL',
  'PL',
  'LL',
  'SA',
  'BL1',
  'L1',
  'UEL',
  'WC',
] as const;

// The channels whose picks a player sees as « une lecture ». Left out: the
// meta channels (no pick of their own), VALUE and SAFE (disconnected from
// the pipeline on 2026-09-03), VANTAGE (the AI's opinion, shown as ≠), the
// price composer's legs and the live/market-move channels.
export const READING_CHANNELS = [
  'DOMINANT',
  'BTTS',
  'DRAW',
  'GOALS',
  'CLEAN_SHEET',
  'TEAM_TOTAL',
  'WIN_EITHER_HALF',
  'FIRST_HALF',
  'DOUBLE_CHANCE',
  'UNDERDOG',
  'FAVORITE',
  'CORRECT_SCORE',
  'RESULT_TOTAL_GOALS',
  'OVER_UNDER_HT',
  'RESULT_BTTS',
  'DRAW_NO_BET',
  'WIN_TO_NIL',
  'HALF_TIME_FULL_TIME',
] as const;

// The match sheet (docs/refonte-ui/06 § 2).

// « Autres paris »: the main lines at 1xBet. OVER_UNDER's 2.5 line lives
// under the bare OVER / UNDER keys.
export const SHEET_MAIN_LINES = [
  { market: 'ONE_X_TWO', pick: 'HOME' },
  { market: 'ONE_X_TWO', pick: 'DRAW' },
  { market: 'ONE_X_TWO', pick: 'AWAY' },
  { market: 'OVER_UNDER', pick: 'OVER' },
  { market: 'OVER_UNDER', pick: 'UNDER' },
  { market: 'BTTS', pick: 'YES' },
  { market: 'BTTS', pick: 'NO' },
] as const;

// « Forme »: five squares per team, all competitions.
export const SHEET_FORM_MATCHES = 5;

// « Face à face »: the last meetings, over a few seasons; fewer than three
// say nothing.
export const SHEET_HEAD_TO_HEAD_MEETINGS = 6;
export const SHEET_HEAD_TO_HEAD_YEARS = 5;
export const SHEET_HEAD_TO_HEAD_MIN = 3;

// The AI's sentence: one line, 90 characters at most, and never jargon: if
// it is not clean it is not shown (06 § 2). VANTAGE's own cleaner fixes the
// codes; these are the words a player should never read.
export const AI_SENTENCE_MAX_LENGTH = 90;
export const AI_SENTENCE_JARGON: readonly RegExp[] = [
  /\bxG\b/i,
  /données internes/i,
  /\bseuil\b/i,
  /probabilit/i,
  /calibr/i,
  /\bcanal\b/i,
  /\d\s?%/,
];

// The public screens (landing hero, share image, /resultats): the same for
// every visitor, cached by the edge for five minutes and by the browser for
// one (16 § 3, « public, s-maxage=300 »).
export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300';

// « Réglés » in Moi: the last 30 followed coupons, then « Voir plus » (09 § 1).
export const ME_SETTLED_PAGE_SIZE = 30;
