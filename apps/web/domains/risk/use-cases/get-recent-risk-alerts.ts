"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { RiskAlert } from "../types/risk-alert";

export function useRecentRiskAlerts(days = 7) {
  return useQuery({
    queryKey: ["risk-recent-alerts", days],
    queryFn: () =>
      clientApiRequest<RiskAlert[]>(`/risk/alerts/recent?days=${days}`, {
        fallbackErrorMessage: "Impossible de charger les alertes de risque.",
      }),
    staleTime: 5 * 60_000,
  });
}
