"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { CouponProposalDto } from "../types/coupon";

export function useCoupons(date: string) {
  return useQuery({
    queryKey: ["coupons", date],
    queryFn: () => {
      const params = new URLSearchParams({ date });
      return clientApiRequest<CouponProposalDto[]>(
        `/coupons?${params.toString()}`,
        { fallbackErrorMessage: "Impossible de charger les coupons." },
      );
    },
    staleTime: 60_000,
  });
}
