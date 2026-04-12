"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardSummary } from "../types/dashboard";
import { clientApiRequest } from "@/lib/api/client-api";

export async function fetchDashboardSummary(
  pnlDate?: string,
): Promise<DashboardSummary> {
  const params = pnlDate ? `?pnlDate=${pnlDate}` : "";
  return clientApiRequest<DashboardSummary>(`/dashboard/summary${params}`, {
    fallbackErrorMessage: "Impossible de charger le dashboard.",
  });
}

export function useDashboardSummary(pnlDate?: string) {
  return useQuery({
    queryKey: ["dashboard-summary", pnlDate ?? null],
    queryFn: () => fetchDashboardSummary(pnlDate),
    refetchInterval: 30_000,
  });
}
