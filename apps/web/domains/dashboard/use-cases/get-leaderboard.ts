"use client";

import { useQuery } from "@tanstack/react-query";
import type { LeaderboardEntry } from "../types/dashboard";
import { clientApiRequest } from "@/lib/api/client-api";

export function useLeaderboard() {
  return useQuery({
    queryKey: ["dashboard-leaderboard"],
    queryFn: () =>
      clientApiRequest<LeaderboardEntry[]>("/dashboard/leaderboard", {
        fallbackErrorMessage: "Impossible de charger le classement.",
      }),
    refetchInterval: 5 * 60_000, // 5 min
  });
}
