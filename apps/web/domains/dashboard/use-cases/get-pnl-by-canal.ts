"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { PnlSummary } from "../types/dashboard";

export type PnlPeriod = "7d" | "30d" | "all";

export type PnlByCanalResponse = {
  period: PnlPeriod;
  global: PnlSummary;
  ev: PnlSummary;
  sv: PnlSummary;
};

export function usePnlByCanal(period: PnlPeriod) {
  return useQuery({
    queryKey: ["pnl-by-canal", period],
    queryFn: () =>
      clientApiRequest<PnlByCanalResponse>(`/dashboard/pnl?period=${period}`, {
        fallbackErrorMessage: "Impossible de charger les stats PnL.",
      }),
    staleTime: 5 * 60_000,
  });
}
