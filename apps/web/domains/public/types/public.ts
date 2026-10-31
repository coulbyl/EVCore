import type {
  TodayAbsence,
  TodayCoupon,
  TodayFormOutcome,
  TodayProductKey,
  TodayYesterdayItem,
} from "@/domains/today/types/today";

/** The hero as a visitor sees it: no follow, no player state. */
export type PublicHero = Omit<TodayCoupon, "followedByMe" | "canFollow">;

/** GET /public/today: the landing and the daily share image (11 § 1). */
export type PublicToday = {
  date: string;
  hero: PublicHero | null;
  /** Without a hero today: the last one of the week, and its day. */
  lastHero: { date: string; coupon: PublicHero } | null;
  heroForm: {
    days: { date: string; outcome: TodayFormOutcome }[];
    won: number;
    played: number;
    since: string | null;
  } | null;
  yesterday: Omit<TodayYesterdayItem, "followedByMe">[];
  absences: TodayAbsence[];
  /** « Nos résultats »: the first lines of Résultats, since launch. */
  results: {
    product: TodayProductKey;
    won: number;
    lost: number;
    refunded: number;
    tooEarly: boolean;
    settledDays: number;
    since: string | null;
  }[];
  ai: { won: number; lost: number; tooEarly: boolean; since: string | null };
};
