"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { FixtureRow } from "../types/fixture";

type FixturesResponse = {
  rows: FixtureRow[];
  total: number;
};

export function useFixtures(date: string) {
  const query = useQuery({
    queryKey: ["fixtures", date],
    queryFn: () =>
      clientApiRequest<FixturesResponse>(`/fixture?date=${date}`, {
        fallbackErrorMessage: "Impossible de charger les fixtures.",
      }),
    staleTime: 30_000,
  });

  return {
    ...query,
    allRows: query.data?.rows ?? [],
    total: query.data?.total ?? 0,
  };
}
