"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { FixtureRow } from "../types/fixture";

type FixturesResponse = {
  rows: FixtureRow[];
  total: number;
  nextCursor: string | null;
};

export function useFixtures(date: string) {
  const query = useInfiniteQuery({
    queryKey: ["fixtures", date],
    queryFn: ({ pageParam }) =>
      clientApiRequest<FixturesResponse>(
        `/fixture?date=${date}${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""
        }`,
        { fallbackErrorMessage: "Impossible de charger les fixtures." },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });

  const allRows = query.data?.pages.flatMap((page) => page.rows) ?? [];

  return {
    ...query,
    allRows,
    total: allRows.length,
  };
}
