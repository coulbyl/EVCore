"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

/** Le relevé du lundi (WEEKLY_STATEMENT, 2026-10-29), texte brut. */
export type WeeklyStatementNotification = {
  id: string;
  title: string;
  body: string;
  payload: { week?: string; settled?: number; net?: string } | null;
  createdAt: string;
};

export function useWeeklyBrief() {
  return useQuery({
    queryKey: ["weekly-brief"],
    queryFn: () =>
      clientApiRequest<{
        data: WeeklyStatementNotification[];
        total: number;
      }>("/notifications?type=WEEKLY_STATEMENT&limit=1", {
        fallbackErrorMessage: "Impossible de charger le relevé.",
      }).then((r) => r.data[0] ?? null),
    staleTime: 60 * 60_000, // 1h — stale anyway until Monday
  });
}
