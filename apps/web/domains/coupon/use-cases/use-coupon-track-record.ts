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
};

export const TRACK_RECORD_DAYS = 30;

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
 * deux générateurs), ou null tant qu'il n'a pas assez de jours réglés.
 */
export function trackRecordFor(
  records: readonly CouponClassTrackRecord[] | undefined,
  product: { couponClass: CouponClassName | null; source: CouponSource },
  minSettled = 5,
): CouponClassTrackRecord | null {
  const found =
    records?.find(
      (r) =>
        r.couponClass === product.couponClass && r.source === product.source,
    ) ?? null;
  return found && found.settled >= minSettled ? found : null;
}
