"use client";

import { useQuery } from "@tanstack/react-query";
import type { BankrollTransaction } from "../types/bankroll";
import { clientApiRequest } from "@/lib/api/client-api";

export async function getBankrollTransactions(
  limit = 200,
): Promise<BankrollTransaction[]> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));

  return clientApiRequest<BankrollTransaction[]>(
    `/bankroll/transactions?${params.toString()}`,
    {
      fallbackErrorMessage: "Impossible de charger les transactions.",
    },
  );
}

export function useBankrollTransactions(limit = 200) {
  return useQuery({
    queryKey: ["bankroll-transactions", limit],
    queryFn: () => getBankrollTransactions(limit),
  });
}
