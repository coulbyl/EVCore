"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { CouponClassName, CouponSource } from "../types/coupon";

/** Ce qu'un produit de coupon a réellement fait sur les `days` derniers jours. */
export type CouponClassTrackRecord = {
  couponClass: CouponClassName | null;
  source: CouponSource;
  days: number;
  settled: number;
  won: number;
  avgOdds: number;
  returnPerUnit: number;
  /** Premier et dernier jour réglés dans la fenêtre (AAAA-MM-JJ). */
  firstDay: string;
  lastDay: string;
};

export const TRACK_RECORD_DAYS = 30;

/**
 * Sous ce nombre de jours réglés, la carte dit « relevé en cours » au lieu
 * d'un taux : 2 jours sur 3 ne disent rien d'un produit.
 */
export const MIN_SETTLED_FOR_RECORD = 5;

export function useCouponTrackRecord(days: number = TRACK_RECORD_DAYS) {
  return useQuery({
    queryKey: ["coupon-track-record", days],
    queryFn: () =>
      clientApiRequest<CouponClassTrackRecord[]>(
        `/coupons/track-record?days=${days}`,
        {
          fallbackErrorMessage:
            "Impossible de charger l'historique des coupons.",
        },
      ),
    staleTime: 5 * 60_000,
  });
}

/**
 * L'entrée d'un produit (classe + source : le coupon long existe sous les
 * deux générateurs), quel que soit son nombre de jours réglés : c'est la
 * carte qui décide d'afficher un taux ou « relevé en cours »
 * (`MIN_SETTLED_FOR_RECORD`). Plus de repli sur une fréquence simulée.
 */
export function trackRecordFor(
  records: readonly CouponClassTrackRecord[] | undefined,
  product: { couponClass: CouponClassName | null; source: CouponSource },
): CouponClassTrackRecord | null {
  return (
    records?.find(
      (r) =>
        r.couponClass === product.couponClass && r.source === product.source,
    ) ?? null
  );
}
