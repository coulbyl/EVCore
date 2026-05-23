"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  InvestmentSummaryCanal,
  InvestmentSummaryResponse,
} from "../types/investment-summary";

type Params = {
  canal: InvestmentSummaryCanal;
  from?: string;
  to?: string;
};

export function useInvestmentSummary({ canal, from, to }: Params) {
  const params = new URLSearchParams({ canal });
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  return useQuery({
    queryKey: ["investment-summary", canal, from, to],
    queryFn: () =>
      clientApiRequest<InvestmentSummaryResponse>(
        `/ai-engine/investment-summary?${params.toString()}`,
        { fallbackErrorMessage: "Impossible de charger le résumé investment." },
      ),
    staleTime: 120_000,
  });
}
