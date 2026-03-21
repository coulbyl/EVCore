"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCouponById } from "../lib/dashboard-api";

export function useCouponById(id: string) {
  return useQuery({
    queryKey: ["coupon", id],
    queryFn: () => fetchCouponById(id),
    staleTime: 30_000,
  });
}
