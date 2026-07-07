"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { InvestmentMode, InvestmentPick } from "../types/investment";

export function useInvestmentPicks(date: string, mode: InvestmentMode) {
  return useQuery({
    queryKey: ["investments", date, mode],
    queryFn: () => {
      const params = new URLSearchParams({ date, mode });
      return clientApiRequest<InvestmentPick[]>(
        `/investments?${params.toString()}`,
        { fallbackErrorMessage: "Impossible de charger les picks." },
      );
    },
    staleTime: 60_000,
  });
}
