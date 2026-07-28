"use client";

import { useQuery } from "@tanstack/react-query";
import type { SubscriptionDetail } from "../types/subscriptions";
import { clientApiRequest } from "@/lib/api/client-api";

export async function getSubscriptionDetail(
  id: string,
): Promise<SubscriptionDetail> {
  return clientApiRequest<SubscriptionDetail>(`/subscriptions/${id}`, {
    fallbackErrorMessage: "Impossible de charger le détail de l'abonnement.",
  });
}

export function useSubscriptionDetail(id: string | null) {
  return useQuery({
    queryKey: ["subscription-detail", id],
    queryFn: () => getSubscriptionDetail(id!),
    enabled: id !== null,
  });
}
