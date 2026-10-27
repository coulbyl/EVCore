"use client";

import { useQuery } from "@tanstack/react-query";
import type { BankrollSummary } from "../types/bankroll";
import { clientApiRequest } from "@/lib/api/client-api";

export async function getBankrollSummary(): Promise<BankrollSummary> {
  return clientApiRequest<BankrollSummary>("/bankroll/summary", {
    fallbackErrorMessage: "Impossible de charger ton solde.",
  });
}

export function useBankrollSummary(userId?: string) {
  return useQuery({
    queryKey: ["bankroll-balance", "summary", userId],
    queryFn: getBankrollSummary,
    enabled: Boolean(userId),
  });
}
