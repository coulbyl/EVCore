"use client";

import { useQuery } from "@tanstack/react-query";
import type { CompetitionStat } from "../types/dashboard";
import { clientApiRequest } from "@/lib/api/client-api";

export type CompetitionStatCanal = "ALL" | "EV" | "SV";

export function useCompetitionStats(canal: CompetitionStatCanal = "ALL") {
  return useQuery({
    queryKey: ["dashboard-competition-stats", canal],
    queryFn: () => {
      const url =
        canal === "ALL"
          ? "/dashboard/competition-stats"
          : `/dashboard/competition-stats?canal=${canal}`;
      return clientApiRequest<CompetitionStat[]>(url, {
        fallbackErrorMessage:
          "Impossible de charger les stats par compétition.",
      });
    },
    refetchInterval: 5 * 60_000,
  });
}
