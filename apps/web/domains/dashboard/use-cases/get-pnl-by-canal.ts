"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { PnlSummary } from "../types/dashboard";

export type PnlPeriod = "7d" | "30d" | "all";

export type PnlByCanalResponse = {
  from: string;
  to: string;
  global: PnlSummary;
  ev: PnlSummary;
  sv: PnlSummary;
};

export function usePnlByCanal(from: string, to: string) {
  return useQuery({
    queryKey: ["pnl-by-canal", from, to],
    queryFn: () =>
      clientApiRequest<PnlByCanalResponse>(
        `/dashboard/pnl?from=${from}&to=${to}`,
        { fallbackErrorMessage: "Impossible de charger les stats PnL." },
      ),
    staleTime: 5 * 60_000,
  });
}

function periodToRange(period: PnlPeriod): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (period === "all") return { from: "2020-01-01", to: today };
  const days = period === "7d" ? 7 : 30;
  const from = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return { from, to: today };
}

export function usePnlByCanalByPeriod(period: PnlPeriod) {
  const { from, to } = periodToRange(period);
  return usePnlByCanal(from, to);
}
