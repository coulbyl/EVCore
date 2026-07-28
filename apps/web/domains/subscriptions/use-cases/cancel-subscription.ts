"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

export async function cancelSubscription(
  id: string,
): Promise<{ cancelled: boolean }> {
  return clientApiRequest<{ cancelled: boolean }>(
    `/subscriptions/${id}/cancel`,
    {
      method: "POST",
      fallbackErrorMessage: "Impossible d'annuler l'abonnement.",
    },
  );
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: async (_, id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
        queryClient.invalidateQueries({
          queryKey: ["subscription-detail", id],
        }),
      ]);
    },
  });
}
