"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { SummaryChannel, SummaryPeriod, SummaryResponse } from "../types/summary";

type SummaryParams = {
  channel: SummaryChannel;
  period?: SummaryPeriod;
  from?: string;
  to?: string;
};

export function useSummary({ channel, period, from, to }: SummaryParams) {
  const params = new URLSearchParams({ channel });
  if (period) params.set("period", period);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  return useQuery({
    queryKey: ["summary", channel, period, from, to],
    queryFn: () =>
      clientApiRequest<SummaryResponse>(`/summary?${params.toString()}`, {
        fallbackErrorMessage: "Impossible de charger le résumé.",
      }),
    staleTime: 60_000,
  });
}
