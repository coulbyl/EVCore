"use client";

import { useQuery } from "@tanstack/react-query";
import type { CompetitionStat } from "../types/dashboard";
import { clientApiRequest } from "@/lib/api/client-api";

export function useCompetitionStats() {
  return useQuery({
    queryKey: ["dashboard-competition-stats"],
    queryFn: () =>
      clientApiRequest<CompetitionStat[]>("/dashboard/competition-stats", {
        fallbackErrorMessage: "Impossible de charger les stats par compétition.",
      }),
    refetchInterval: 5 * 60_000, // 5 min
  });
}
