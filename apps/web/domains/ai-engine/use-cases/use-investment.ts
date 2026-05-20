"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { InvestmentDayDto } from "../types/investment";

export function useInvestment(date: string) {
  return useQuery({
    queryKey: ["investment", date],
    queryFn: () => {
      const params = new URLSearchParams({ date });
      return clientApiRequest<InvestmentDayDto>(
        `/ai-engine/investment?${params.toString()}`,
        {
          fallbackErrorMessage:
            "Impossible de charger les données d'investissement.",
        },
      );
    },
    staleTime: 120_000,
  });
}
