import type { TodayAbsence, TodayCoupon } from "@/domains/today/types/today";

/** Mirror of apps/backend screens/results.types.ts (GET /results/products). */
export const RESULTS_PERIODS = ["30", "90", "all"] as const;
export type ResultsPeriod = (typeof RESULTS_PERIODS)[number];

export const RESULTS_PRODUCT_KEYS = [
  "FAVOURITE",
  "COMBO",
  "DOUBLE",
  "HUNTER_BTTS",
  "HUNTER_DRAW",
  "HUNTER_SCORE",
  "HUNTER_CORNERS",
  "COMBO_AI",
  "LONG",
  "UNIQUE",
] as const;
export type ResultsProductKey = (typeof RESULTS_PRODUCT_KEYS)[number];

export type DayOutcome = "won" | "lost" | "refunded" | "pending";

/** « Annoncé 8 sur 10 · Réalisé 8 sur 10 » over the same days (08 § 2). */
export type ResultsComparison = {
  days: number;
  from: string | null;
  to: string | null;
  announced: number;
  realised: number;
};

/** « En francs, à 1 000 F par jour » (08 § 2). */
export type ResultsFrancs = {
  days: number;
  staked: number;
  returned: number;
  unpricedDays: number;
  from: string | null;
  to: string | null;
};

export type ProductSummary = {
  product: ResultsProductKey;
  retired: boolean;
  launchedOn: string;
  since: string;
  won: number;
  lost: number;
  refunded: number;
  daysWithoutCoupon: number;
  worstLosingStreak: number;
  /** The last ten days played, oldest first, whatever the period. */
  last: ("won" | "lost")[];
  tooEarly: boolean;
  settledDays: number;
  comparison: ResultsComparison | null;
  francs: ResultsFrancs | null;
};

export type AiSummary = {
  since: string | null;
  won: number;
  lost: number;
  refunded: number;
  last: ("won" | "lost")[];
  tooEarly: boolean;
  comparison: ResultsComparison | null;
  francs: ResultsFrancs | null;
};

export type ResultsScreen = {
  period: ResultsPeriod;
  yesterday: {
    date: string;
    items: {
      product: ResultsProductKey;
      outcome: DayOutcome;
      paidOdds: number | null;
    }[];
  };
  week: {
    week: string;
    products: { product: ResultsProductKey; won: number; played: number }[];
  } | null;
  products: ProductSummary[];
  ai: AiSummary;
};

/** A cell of the grid: one per calendar day of the period, oldest first. */
export type ResultsGridDay = {
  date: string;
  outcome: DayOutcome | "none";
};

/** « Jour par jour », most recent first. */
export type ResultsDay =
  | {
      date: string;
      outcome: DayOutcome;
      label: string;
      market: string | null;
      pick: string | null;
      paidOdds: number | null;
      couponId: string;
    }
  | { date: string; outcome: "none"; reason: string | null };

/** GET /results/products/:product?period=. */
export type ProductDetail = ProductSummary & {
  grid: ResultsGridDay[];
  days: ResultsDay[];
};

export type AiOpinion = {
  date: string;
  label: string;
  market: string;
  pick: string;
  odds: number;
  outcome: "won" | "lost" | "refunded";
  settingChanged: boolean;
};

/** GET /results/ai?period=. */
export type AiDetail = AiSummary & { opinions: AiOpinion[] };

/** GET /results/yesterday: yesterday's coupons as Aujourd'hui showed them (08 § 3). */
export type YesterdayScreen = {
  date: string;
  heroId: string | null;
  coupons: TodayCoupon[];
  absences: TodayAbsence[];
};

/** GET /results/week: « Ta semaine », the Monday statement (08 § 3). */
export type WeekScreen = {
  week: string;
  days: {
    date: string;
    marks: {
      product: ResultsProductKey;
      outcome: DayOutcome;
      paidOdds: number | null;
    }[];
  }[];
  products: { product: ResultsProductKey; won: number; played: number }[];
  followed: { won: number; lost: number; refunded: number };
};
