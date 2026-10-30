// The answer of GET /today (apps/backend/src/modules/screens/today.types.ts),
// dates as ISO strings.

export type TodayProductKey =
  | "FAVOURITE"
  | "COMBO"
  | "DOUBLE"
  | "HUNTER_BTTS"
  | "HUNTER_DRAW"
  | "HUNTER_SCORE"
  | "HUNTER_CORNERS";

export type TodayCouponState = "upcoming" | "live" | "won" | "lost" | "void";

export type TodayLegState =
  | "upcoming"
  | "live"
  | "won"
  | "lost"
  | "void"
  | "postponed";

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
  chance: number | null;
  marketFrequency: number | null;
  /** One sentence about the bet; null when there is none. */
  fact: string | null;
  state: TodayLegState;
  score: { home: number; away: number } | null;
};

export type TodayCoupon = {
  id: string;
  product: TodayProductKey;
  forDate: string;
  state: TodayCouponState;
  firstKickoffAt: string;
  /** Product of the legs' 1xBet prices; null if one leg has none. */
  odds: number | null;
  referenceOdds: number;
  paidOdds: number | null;
  /** In [0, 1]; null if one leg's chance is unknown. */
  chance: number | null;
  followedByMe: boolean;
  /** Following is only offered before the first kick-off. */
  canFollow: boolean;
  legs: TodayLeg[];
};

export type TodayFormOutcome = "won" | "lost" | "void";

export type TodayProductForm = {
  product: TodayProductKey;
  /** Settled days, oldest first. */
  days: { date: string; outcome: TodayFormOutcome }[];
  won: number;
  played: number;
  worstLosingStreak: number;
};

export type TodayYesterdayItem = {
  product: TodayProductKey;
  outcome: TodayFormOutcome | "pending";
  followedByMe: boolean;
};

export type TodayAbsence = {
  product: TodayProductKey;
  /** The engine's reason code (messages: couponAbstentions.reasons). */
  reason: string | null;
};

export type TodayScreen = {
  date: string;
  yesterday: TodayYesterdayItem[];
  /** Monday only: « Ta semaine » replaces « Hier ». */
  week: {
    week: string;
    products: { product: TodayProductKey; won: number; played: number }[];
  } | null;
  /** The hero card, chosen by the server; null when nothing plays today. */
  heroId: string | null;
  coupons: TodayCoupon[];
  absences: TodayAbsence[];
  /** Followed coupons of earlier days still running. */
  followedInProgress: TodayCoupon[];
  forms: TodayProductForm[];
};
