"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

export type WeeklyBriefNotification = {
  id: string;
  title: string;
  body: string;
  payload: {
    narrative?: string;
    roiOneXTwo?: number;
    betsPlaced?: number;
    bestCompetition?: string | null;
    periodStart?: string;
    periodEnd?: string;
  } | null;
  createdAt: string;
};

export function useWeeklyBrief() {
  return useQuery({
    queryKey: ["weekly-brief"],
    queryFn: () =>
      clientApiRequest<{
        data: WeeklyBriefNotification[];
        total: number;
      }>("/notifications?type=WEEKLY_REPORT&limit=1", {
        fallbackErrorMessage: "Impossible de charger le brief.",
      }).then((r) => r.data[0] ?? null),
    staleTime: 60 * 60_000, // 1h — stale anyway until Monday
  });
}
