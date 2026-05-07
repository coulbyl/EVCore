"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import { todayIso } from "@/lib/date";
import type { FixtureRow } from "../types/fixture";

type PicksResponse = {
  rows: FixtureRow[];
  total: number;
};

export function usePicksOfTheDay(date?: string) {
  const resolvedDate = date ?? todayIso();
  return useQuery({
    queryKey: ["picks-of-the-day", resolvedDate],
    queryFn: () => {
      const params = new URLSearchParams({ date: resolvedDate });
      return clientApiRequest<PicksResponse>(`/fixture?${params.toString()}`, {
        fallbackErrorMessage: "Impossible de charger les picks.",
      });
    },
    staleTime: 30_000,
  });
}
