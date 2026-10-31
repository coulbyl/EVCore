/** Mirror of apps/backend screens/results.types.ts (GET /results/products). */
export const RESULTS_PERIODS = ["30", "90", "all"] as const;
export type ResultsPeriod = (typeof RESULTS_PERIODS)[number];

export type ResultsProductKey =
  | "FAVOURITE"
  | "COMBO"
  | "DOUBLE"
  | "HUNTER_BTTS"
  | "HUNTER_DRAW"
  | "HUNTER_SCORE"
  | "HUNTER_CORNERS"
  | "COMBO_AI"
  | "LONG"
  | "UNIQUE";

export type DayOutcome = "won" | "lost" | "refunded" | "pending";

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
};

export type AiSummary = {
  since: string | null;
  won: number;
  lost: number;
  refunded: number;
  last: ("won" | "lost")[];
  tooEarly: boolean;
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
