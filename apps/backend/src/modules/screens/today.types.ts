import type { TODAY_PRODUCTS } from '@config/screens.constants';

/** A product of « Aujourd'hui » (screens.constants.ts). */
export type TodayProductKey = (typeof TODAY_PRODUCTS)[number];

/**
 * Where a coupon stands (04 § 2). `won` covers the partial gain (one match
 * refunded, the others won): `paidOdds` then says what was really paid.
 */
export type TodayCouponState = 'upcoming' | 'live' | 'won' | 'lost' | 'void';

/** A match of a coupon. `postponed` until settlement refunds it as `void`. */
export type TodayLegState =
  | 'upcoming'
  | 'live'
  | 'won'
  | 'lost'
  | 'void'
  | 'postponed';

export type TodayTeam = {
  name: string;
  shortName: string;
  logoUrl: string | null;
};

export type TodayLeg = {
  fixtureId: string;
  kickoffAt: string;
  competition: { code: string; name: string };
  home: TodayTeam;
  away: TodayTeam;
  market: string;
  pick: string;
  line: number | null;
  /** The 1xBet price stored at generation; null when 1xBet had none. */
  odds: number | null;
  /** One sentence about the bet (04 § 1); null when there is none. */
  fact: string | null;
  state: TodayLegState;
  /** Full-time score, once the match is finished. */
  score: { home: number; away: number } | null;
};

export type TodayCoupon = {
  id: string;
  product: TodayProductKey;
  forDate: string;
  state: TodayCouponState;
  /** Kick-off of the first match: the card shows it until it starts. */
  firstKickoffAt: string;
  /** Product of the legs' 1xBet prices; null if one leg has none. */
  odds: number | null;
  /** The reference price the engine composed on. */
  referenceOdds: number;
  /** Paid odds of a won coupon (lower than `odds` after a refunded leg). */
  paidOdds: number | null;
  /** Joint probability announced at generation, in [0, 1]. */
  probability: number;
  followedByMe: boolean;
  /** Following is only offered before the first kick-off (04 § 3). */
  canFollow: boolean;
  legs: TodayLeg[];
};

export type TodayFormOutcome = 'won' | 'lost' | 'void';

/** « 19 jours gagnés sur 24 · pire série 1 », and the ✓ ✗ strip (04 § 1). */
export type TodayProductForm = {
  product: TodayProductKey;
  /** Settled days, oldest first; a day without a coupon is not listed. */
  days: { date: string; outcome: TodayFormOutcome }[];
  won: number;
  /** Won + lost: a refunded day is neither. */
  played: number;
  worstLosingStreak: number;
};

/** One word of the « Hier » line (04 § 4); `pending` reads « … ». */
export type TodayYesterdayItem = {
  product: TodayProductKey;
  outcome: TodayFormOutcome | 'pending';
  followedByMe: boolean;
};

/** « Pas de Favori aujourd'hui · <raison> » (04 § 5). */
export type TodayAbsence = {
  product: TodayProductKey;
  /** The engine's reason code; the wording lives on the web. */
  reason: string | null;
};

/** GET /today: everything the « Aujourd'hui » screen shows, in one answer. */
export type TodayScreen = {
  /** The day shown (UTC), YYYY-MM-DD. */
  date: string;
  yesterday: TodayYesterdayItem[];
  /**
   * The coupon of the hero card, chosen by the server (TODAY_HERO_RELAY):
   * null when nothing plays today.
   */
  heroId: string | null;
  /** Today's coupons, in screen order. */
  coupons: TodayCoupon[];
  absences: TodayAbsence[];
  /** Followed coupons of earlier days still running. */
  followedInProgress: TodayCoupon[];
  forms: TodayProductForm[];
};
