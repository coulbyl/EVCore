"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

export async function deleteSubscription(
  id: string,
): Promise<{ deleted: boolean }> {
  return clientApiRequest<{ deleted: boolean }>(`/subscriptions/${id}`, {
    method: "DELETE",
    fallbackErrorMessage: "Impossible de supprimer l'abonnement.",
  });
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSubscription,
    onSuccess: async (_, id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
        queryClient.removeQueries({ queryKey: ["subscription-detail", id] }),
      ]);
    },
  });
}
