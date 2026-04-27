"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import { todayIso } from "@/lib/date";
import type { FixtureRow } from "../types/fixture";

type PicksResult = { rows: FixtureRow[]; total: number };

export function usePicksOfTheDay() {
  return useQuery({
    queryKey: ["picks-of-the-day"],
    queryFn: () =>
      clientApiRequest<PicksResult>(`/fixture?date=${todayIso()}`, {
        fallbackErrorMessage: "Impossible de charger les picks.",
      }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
