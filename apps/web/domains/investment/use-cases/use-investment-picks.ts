"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  InvestmentChannel,
  InvestmentPick,
  InvestmentView,
} from "../types/investment";

export function useInvestmentPicks(query: {
  date: string;
  view: InvestmentView;
  // Colonne filtrable des vues « En observation » et « Écarté ». Sans effet
  // sur « Ce qu'on assume », dont le contenu est défini par la mesure.
  channel: InvestmentChannel | null;
}) {
  const { date, view, channel } = query;
  return useQuery({
    queryKey: ["investments", date, view, channel],
    queryFn: () => {
      const params = new URLSearchParams({ date, view });
      if (channel !== null) params.set("channel", channel);
      return clientApiRequest<InvestmentPick[]>(
        `/investments?${params.toString()}`,
        { fallbackErrorMessage: "Impossible de charger les picks." },
      );
    },
    staleTime: 60_000,
  });
}
