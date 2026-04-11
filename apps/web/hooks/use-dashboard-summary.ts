"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDashboardSummary } from "../lib/dashboard-api";

export function useDashboardSummary(pnlDate?: string) {
  return useQuery({
    queryKey: ["dashboard-summary", pnlDate ?? null],
    queryFn: () => fetchDashboardSummary(pnlDate),
    refetchInterval: 30_000,
  });
}
