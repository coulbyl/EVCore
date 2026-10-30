import type { TodayCoupon } from './today.types';

/** « 7 coupons gagnés · 4 perdus · 1 remboursé, depuis le 13/10 » (09 § 1). */
export type MeRecord = {
  won: number;
  lost: number;
  /** Neither won nor lost; shown only when there is one. */
  refunded: number;
  /** First follow (ISO); null before the first. */
  since: string | null;
};

/** One page of « Réglés », most recent last match first. */
export type MeSettledPage = {
  coupons: TodayCoupon[];
  /** Pass it back to GET /me/settled for « Voir plus »; null at the end. */
  nextCursor: string | null;
};

/** GET /me: the first level of Moi in one answer (09 § 1). */
export type MeScreen = {
  firstName: string;
  record: MeRecord;
  /** Followed coupons not settled yet, first kick-off first. */
  inProgress: TodayCoupon[];
  settled: MeSettledPage;
  /** Team replies not read yet: « 1 réponse » on the Messages line. */
  unreadReplies: number;
  /** End of the player's pause (ISO) while it runs, null otherwise. */
  pausedUntil: string | null;
};
