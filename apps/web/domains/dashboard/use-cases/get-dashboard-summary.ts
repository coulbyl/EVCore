"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardSummary } from "../types/dashboard";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function fetchDashboardSummary(
  pnlDate?: string,
): Promise<DashboardSummary> {
  const params = pnlDate ? `?pnlDate=${pnlDate}` : "";
  const response = await fetch(`${BACKEND_URL}/dashboard/summary${params}`);

  if (!response.ok) {
    throw new Error(`Impossible de charger le dashboard (${response.status})`);
  }

  return (await response.json()) as DashboardSummary;
}

export function useDashboardSummary(pnlDate?: string) {
  return useQuery({
    queryKey: ["dashboard-summary", pnlDate ?? null],
    queryFn: () => fetchDashboardSummary(pnlDate),
    refetchInterval: 30_000,
  });
}
