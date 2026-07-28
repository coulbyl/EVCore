"use client";

import { useQuery } from "@tanstack/react-query";
import type { Subscription } from "../types/subscriptions";
import { clientApiRequest } from "@/lib/api/client-api";

export async function getSubscriptions(): Promise<Subscription[]> {
  return clientApiRequest<Subscription[]>("/subscriptions", {
    fallbackErrorMessage: "Impossible de charger les abonnements.",
  });
}

export function useSubscriptions(userId?: string) {
  return useQuery({
    queryKey: ["subscriptions", userId],
    queryFn: getSubscriptions,
    enabled: Boolean(userId),
  });
}
