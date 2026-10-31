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

// The reading of a match (06 § 8, decided 2026-10-31): a « speaking » pick
// (who wins, double chance, over/under 2.5 goals) when its chance is within
// this distance of the best one, the best chance otherwise. Measured on
// 1 556 settled matches (2026-10-08 → 10-28, production copy): 428 readings
// change, mostly to double chance; the speaking pick lands as often (75.5 %
// vs 75.7 %) and announces its rate exactly where the best one announced
// 80.0 % for 75.7 %.
export const READING_SPEAKING_TOLERANCE = 0.1;

// The speaking picks: market → picks, `null` for every pick of the market.
// OVER_UNDER keeps its line in `pick`: OVER/UNDER is the 2.5 line.
export const READING_SPEAKING_PICKS: Readonly<
  Record<string, readonly string[] | null>
> = {
  ONE_X_TWO: null,
  DOUBLE_CHANCE: null,
  OVER_UNDER: ['OVER', 'UNDER'],
};

// Tomorrow's matches still without an analysis read « Lecture ce soir »
// until this hour (UTC): the 17:00 preview pass (ROLLING_HORIZON) is
// overwritten by the 18:00 and 20:00 runs. After it, a match left out will
// not be read tonight: « Pas de lecture » (06 § 1).
export const TOMORROW_READINGS_UNTIL_HOUR_UTC = 21;

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

// The public screens (landing hero, share image, /resultats): the same for
// every visitor, cached by the edge for five minutes and by the browser for
// one (16 § 3, « public, s-maxage=300 »).
export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300';

// « Réglés » in Moi: the last 30 followed coupons, then « Voir plus » (09 § 1).
export const ME_SETTLED_PAGE_SIZE = 30;

// « Matchs » and the match sheet are the same for every player: their reads
// are shared (SharedReads) and served this long, about one odds ingestion
// cycle; after that the last answer is still served while one fresh read
// runs. A page or sheet nobody opened for SCREEN_READS_KEEP_MS is forgotten.
export const SCREEN_READS_TTL_MS = 60_000;
export const SCREEN_READS_KEEP_MS = 10 * 60_000;
// Pages and sheets kept at most (a team search makes its own page).
export const SCREEN_READS_MAX_KEYS = 500;

// « Vérifie ton ticket » (refonte 07 § 4): one call per opening of the sheet
// or change of the ticket, a few a minute at most for a player.
export const TICKET_QUOTE_RATE_LIMIT = { limit: 60, ttlMs: 60_000 } as const;

// The landing on a day without a hero (decided 31/10, a marketing call):
// the last hero that won within this many days, labelled as such, its form
// and the full record beside it. Each day looked at is one read; the web
// caches the answer a minute.
export const LAST_WON_LOOKBACK_DAYS = 14;
