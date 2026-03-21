"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCouponsByPeriod } from "../lib/dashboard-api";

export function useCouponsByPeriod(params: {
  from: string;
  to: string;
  query?: string;
  status?: "PENDING" | "WON" | "LOST";
}) {
  return useQuery({
    queryKey: [
      "coupons-by-period",
      params.from,
      params.to,
      params.query ?? "",
      params.status ?? "",
    ],
    queryFn: () => fetchCouponsByPeriod(params),
  });
}
