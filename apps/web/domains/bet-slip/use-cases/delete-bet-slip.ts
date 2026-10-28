"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

export async function deleteBetSlip(id: string): Promise<{ refunded: string }> {
  return clientApiRequest<{ refunded: string }>(`/bet-slips/${id}`, {
    method: "DELETE",
    fallbackErrorMessage: "Impossible de supprimer ce coupon.",
  });
}

/** Supprime un coupon et rafraîchit tout ce qui en dépend : la liste, le
 * détail, le résumé, le solde et son historique, les coupons joués. */
export function useDeleteBetSlip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBetSlip,
    onSuccess: async () => {
      await Promise.all(
        [
          ["bet-slips"],
          ["bet-slip"],
          ["operator-summary"],
          ["bankroll-balance"],
          ["bankroll-transactions"],
          ["coupons"],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });
}
