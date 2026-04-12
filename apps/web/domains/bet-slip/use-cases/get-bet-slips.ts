"use client";

import { useQuery } from "@tanstack/react-query";
import type { BetSlipView } from "../types/bet-slip";
import { clientApiRequest } from "@/lib/api/client-api";

export async function getBetSlips(): Promise<BetSlipView[]> {
  return clientApiRequest<BetSlipView[]>("/bet-slips", {
    fallbackErrorMessage: "Impossible de charger les tickets.",
  });
}

export async function getBetSlipById(id: string): Promise<BetSlipView> {
  return clientApiRequest<BetSlipView>(`/bet-slips/${id}`, {
    fallbackErrorMessage: "Ticket introuvable.",
  });
}

export function useBetSlips() {
  return useQuery({
    queryKey: ["bet-slips"],
    queryFn: getBetSlips,
  });
}

export function useBetSlipById(id: string) {
  return useQuery({
    queryKey: ["bet-slip", id],
    queryFn: () => getBetSlipById(id),
    enabled: id.length > 0,
  });
}
