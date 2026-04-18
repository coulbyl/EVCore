"use client";

import { useQuery } from "@tanstack/react-query";
import type { BankrollBalance } from "../types/bankroll";
import { clientApiRequest } from "@/lib/api/client-api";

export async function getBankrollBalance(): Promise<BankrollBalance> {
  return clientApiRequest<BankrollBalance>("/bankroll/balance", {
    fallbackErrorMessage: "Impossible de charger la bankroll.",
  });
}

export function useBankrollBalance() {
  return useQuery({
    queryKey: ["bankroll-balance"],
    queryFn: getBankrollBalance,
  });
}
