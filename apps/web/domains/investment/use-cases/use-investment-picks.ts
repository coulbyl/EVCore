"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { InvestmentMode, InvestmentPick } from "../types/investment";

export function useInvestmentPicks(query: {
  date: string;
  mode: InvestmentMode;
  // null = laisser le backend appliquer le topN par défaut du mode
  topN: number | null;
}) {
  const { date, mode, topN } = query;
  return useQuery({
    queryKey: ["investments", date, mode, topN],
    queryFn: () => {
      const params = new URLSearchParams({ date, mode });
      if (topN !== null) params.set("topN", String(topN));
      return clientApiRequest<InvestmentPick[]>(
        `/investments?${params.toString()}`,
        { fallbackErrorMessage: "Impossible de charger les picks." },
      );
    },
    staleTime: 60_000,
  });
}
