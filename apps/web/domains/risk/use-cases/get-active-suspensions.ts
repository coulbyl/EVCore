"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { ActiveMarketSuspension } from "../types/risk-alert";

export function useActiveSuspensions() {
  return useQuery({
    queryKey: ["risk-active-suspensions"],
    queryFn: () =>
      clientApiRequest<ActiveMarketSuspension[]>("/risk/suspensions/active", {
        fallbackErrorMessage: "Impossible de charger les marchés suspendus.",
      }),
    staleTime: 5 * 60_000,
  });
}
