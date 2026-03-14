"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDashboardSummary } from "../lib/dashboard-api";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
    refetchInterval: 30_000,
  });
}
