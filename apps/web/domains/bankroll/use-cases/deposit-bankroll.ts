"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { BankrollBalance } from "../types/bankroll";
import { clientApiRequest } from "@/lib/api/client-api";

type DepositBankrollInput = {
  amount: number;
  note?: string;
};

export async function depositBankroll(
  input: DepositBankrollInput,
): Promise<BankrollBalance> {
  return clientApiRequest<BankrollBalance>("/bankroll/deposit", {
    method: "POST",
    body: input,
    fallbackErrorMessage: "Impossible d'enregistrer le dépôt.",
  });
}

/** Retrait déclaré : jamais au-delà du solde (le serveur refuse). */
export async function withdrawBankroll(
  input: DepositBankrollInput,
): Promise<BankrollBalance> {
  return clientApiRequest<BankrollBalance>("/bankroll/withdrawal", {
    method: "POST",
    body: input,
    fallbackErrorMessage: "Impossible d'enregistrer le retrait.",
  });
}

export function useDepositBankroll(mode: "deposit" | "withdraw" = "deposit") {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mode === "deposit" ? depositBankroll : withdrawBankroll,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bankroll-balance"] }),
        queryClient.invalidateQueries({ queryKey: ["bankroll-transactions"] }),
      ]);
    },
  });
}
