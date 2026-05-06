"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import { todayIso } from "@/lib/date";
import type { FixtureRow } from "../types/fixture";

type PicksPage = {
  rows: FixtureRow[];
  total: number;
  nextCursor: string | null;
};

const PICKS_PAGE_LIMIT = 25;

export function usePicksOfTheDay(date?: string) {
  const resolvedDate = date ?? todayIso();
  return useInfiniteQuery({
    queryKey: ["picks-of-the-day", resolvedDate],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams({
        date: resolvedDate,
        limit: String(PICKS_PAGE_LIMIT),
      });
      if (pageParam) params.set("cursor", pageParam);
      return clientApiRequest<PicksPage>(`/fixture?${params.toString()}`, {
        fallbackErrorMessage: "Impossible de charger les picks.",
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}
