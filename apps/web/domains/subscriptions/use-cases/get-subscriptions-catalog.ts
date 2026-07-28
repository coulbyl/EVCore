"use client";

import { useQuery } from "@tanstack/react-query";
import type { SubscriptionCatalog } from "../types/subscriptions";
import { clientApiRequest } from "@/lib/api/client-api";

export async function getSubscriptionsCatalog(): Promise<SubscriptionCatalog> {
  return clientApiRequest<SubscriptionCatalog>("/subscriptions/catalog", {
    fallbackErrorMessage: "Impossible de charger le catalogue des abonnements.",
  });
}

export function useSubscriptionsCatalog() {
  return useQuery({
    queryKey: ["subscriptions-catalog"],
    queryFn: getSubscriptionsCatalog,
    // Catalogue quasi-statique (sources/ligues/jours pré-construits) — pas
    // besoin de le refetch à chaque focus.
    staleTime: 5 * 60 * 1000,
  });
}
