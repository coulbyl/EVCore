"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  InvestmentIndicesCanal,
  InvestmentIndicesResponse,
} from "../types/investment-indices";

type Params = {
  canal: InvestmentIndicesCanal;
  from?: string;
  to?: string;
  enabled?: boolean;
};

export function useInvestmentIndices({
  canal,
  from,
  to,
  enabled = true,
}: Params) {
  const params = new URLSearchParams({ canal });
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  return useQuery({
    queryKey: ["investment-indices", canal, from, to],
    queryFn: () =>
      clientApiRequest<InvestmentIndicesResponse>(
        `/coupons/indices?${params.toString()}`,
        { fallbackErrorMessage: "Impossible de charger les indices." },
      ),
    staleTime: 300_000,
    enabled,
  });
}
