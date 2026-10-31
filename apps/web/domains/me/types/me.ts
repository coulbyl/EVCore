import type { TodayCoupon } from "@/domains/today/types/today";

/** Mirror of apps/backend screens/me.types.ts (GET /me, GET /me/settled). */
export type MeRecord = {
  won: number;
  lost: number;
  refunded: number;
  /** First follow (ISO); null before the first. */
  since: string | null;
};

export type MeSettledPage = {
  coupons: TodayCoupon[];
  nextCursor: string | null;
};

export type MeScreen = {
  firstName: string;
  record: MeRecord;
  inProgress: TodayCoupon[];
  settled: MeSettledPage;
  unreadReplies: number;
  pausedUntil: string | null;
};
