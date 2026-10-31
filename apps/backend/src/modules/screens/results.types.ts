import type {
  RESULTS_PERIODS,
  RESULTS_PRODUCTS,
} from '@config/results.constants';

export type ResultsPeriod = (typeof RESULTS_PERIODS)[number];
export type ResultsProductKey = (typeof RESULTS_PRODUCTS)[number]['key'];

/** A day of a product; `pending` until settled (08 § 4: never « en attente » on screen). */
export type DayOutcome = 'won' | 'lost' | 'refunded' | 'pending';

/**
 * « Annoncé 8 sur 10 · Réalisé 8 sur 10 » (08 § 2), over the same days:
 * those played whose announced chance is known.
 */
export type ResultsComparison = {
  days: number;
  /** Mean of the chances shown, in [0, 1]. */
  announced: number;
  /** Won over played, in [0, 1]. */
  realised: number;
};

/**
 * « En francs, à 1 000 F par jour » (08 § 2): staked and returned on the
 * played days priced at 1xBet on every leg, won or lost alike; the others
 * are counted apart, never as zero.
 */
export type ResultsFrancs = {
  days: number;
  staked: number;
  returned: number;
  /** Played days with a leg unpriced at 1xBet: left out above. */
  unpricedDays: number;
  from: string | null;
  to: string | null;
};

/** One line of « Résultats » (08 § 1). */
export type ProductSummary = {
  product: ResultsProductKey;
  /** Shown to admins only. */
  retired: boolean;
  launchedOn: string;
  /** First day counted in the period (never before launch). */
  since: string;
  won: number;
  lost: number;
  /** Neither won nor lost: not in « sur 14 ». */
  refunded: number;
  /** Days the product abstained in the period. */
  daysWithoutCoupon: number;
  /** Lost days in a row in the period; a refunded day neither breaks nor extends it. */
  worstLosingStreak: number;
  /** The last ten days played, oldest first, whatever the period. */
  last: ('won' | 'lost')[];
  /** Fewer than RESULTS_TOO_EARLY_DAYS settled days since launch. */
  tooEarly: boolean;
  settledDays: number;
  /** Null while too early. */
  comparison: ResultsComparison | null;
  /** Null while too early. */
  francs: ResultsFrancs | null;
};

/** « Avis IA », counted per opinion rather than per day (08 § 1). */
export type AiSummary = {
  since: string | null;
  won: number;
  lost: number;
  refunded: number;
  last: ('won' | 'lost')[];
  tooEarly: boolean;
  comparison: ResultsComparison | null;
  francs: ResultsFrancs | null;
};

/**
 * « Hier » at the top of Résultats (08 § 1): each coupon of yesterday of
 * the products of « Aujourd'hui », its outcome, the odds really paid after
 * a win. Monday: `week` instead, « Ta semaine » (B7, 04 § 4).
 */
export type ResultsYesterday = {
  date: string;
  items: {
    product: ResultsProductKey;
    outcome: DayOutcome;
    /** The 1xBet odds paid on a won day; null otherwise or unknown. */
    paidOdds: number | null;
  }[];
};

export type ResultsWeek = {
  /** Its Monday, YYYY-MM-DD. */
  week: string;
  products: { product: ResultsProductKey; won: number; played: number }[];
};

/** GET /results/products?period=. */
export type ResultsScreen = {
  period: ResultsPeriod;
  yesterday: ResultsYesterday;
  /** Mondays only. */
  week: ResultsWeek | null;
  products: ProductSummary[];
  ai: AiSummary;
};

/** A cell of the detail grid: one per calendar day of the period. */
export type ResultsGridDay = {
  date: string;
  outcome: DayOutcome | 'none';
};

/** « Jour par jour » (08 § 2), most recent first. */
export type ResultsDay =
  | {
      date: string;
      outcome: DayOutcome;
      /** « PSG – Lens », or « 3 matchs » for a combo. */
      label: string;
      /** The bet, for a single match. */
      market: string | null;
      pick: string | null;
      /** The 1xBet odds really paid on a won day; null otherwise or unknown. */
      paidOdds: number | null;
      couponId: string;
    }
  | {
      date: string;
      outcome: 'none';
      /** The engine's abstention reason code, or null. */
      reason: string | null;
    };

/** GET /results/products/:product?period=. */
export type ProductDetail = ProductSummary & {
  grid: ResultsGridDay[];
  days: ResultsDay[];
};
