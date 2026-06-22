"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  CouponIndicesCanal,
  CouponIndicesResponse,
} from "../types/coupon-indices";

type Params = {
  canal: CouponIndicesCanal;
  from?: string;
  to?: string;
  enabled?: boolean;
};

export function useCouponIndices({
  canal,
  from,
  to,
  enabled = true,
}: Params) {
  const params = new URLSearchParams({ canal });
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  return useQuery({
    queryKey: ["coupon-indices", canal, from, to],
    queryFn: () =>
      clientApiRequest<CouponIndicesResponse>(
        `/coupons/indices?${params.toString()}`,
        { fallbackErrorMessage: "Impossible de charger les indices." },
      ),
    staleTime: 300_000,
    enabled,
  });
}
