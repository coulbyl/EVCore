"use client";

import { useQuery } from "@tanstack/react-query";
import type { BetSlipView } from "../types/bet-slip";
import { clientApiRequest } from "@/lib/api/client-api";

export async function getBetSlips(
  from?: string,
  to?: string,
): Promise<BetSlipView[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.size > 0 ? `?${params.toString()}` : "";
  return clientApiRequest<BetSlipView[]>(`/bet-slips${qs}`, {
    fallbackErrorMessage: "Impossible de charger les coupons.",
  });
}

export async function getBetSlipById(id: string): Promise<BetSlipView> {
  return clientApiRequest<BetSlipView>(`/bet-slips/${id}`, {
    fallbackErrorMessage: "Coupon introuvable.",
  });
}

export function useBetSlips(from?: string, to?: string) {
  return useQuery({
    queryKey: ["bet-slips", from, to],
    queryFn: () => getBetSlips(from, to),
  });
}

export function useBetSlipById(id: string) {
  return useQuery({
    queryKey: ["bet-slip", id],
    queryFn: () => getBetSlipById(id),
    enabled: id.length > 0,
  });
}
