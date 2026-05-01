"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import { todayIso } from "@/lib/date";
import type { FixtureRow } from "../types/fixture";

type PicksResult = { rows: FixtureRow[]; total: number };

export function usePicksOfTheDay(date?: string) {
  const resolvedDate = date ?? todayIso();
  return useQuery({
    queryKey: ["picks-of-the-day", resolvedDate],
    queryFn: () =>
      clientApiRequest<PicksResult>(`/fixture?date=${resolvedDate}`, {
        fallbackErrorMessage: "Impossible de charger les picks.",
      }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
