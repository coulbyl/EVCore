"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { FixtureFilters, FixtureRow } from "../types/fixture";

type FixturesPage = {
  rows: FixtureRow[];
  total: number;
  nextCursor: string | null;
};

const FIXTURES_PAGE_LIMIT = 25;

function buildParams(
  filters: FixtureFilters,
  cursor?: string,
): URLSearchParams {
  const params = new URLSearchParams({
    date: filters.date,
    limit: String(FIXTURES_PAGE_LIMIT),
  });
  if (filters.competition !== "ALL")
    params.set("competition", filters.competition);
  if (filters.decision !== "ALL") params.set("decision", filters.decision);
  if (filters.status !== "ALL") params.set("status", filters.status);
  if (filters.timeSlot !== "ALL") params.set("timeSlot", filters.timeSlot);
  if (filters.betStatus !== "ALL") params.set("betStatus", filters.betStatus);
  if (cursor) params.set("cursor", cursor);
  return params;
}

function filterByCanal(
  rows: FixtureRow[],
  canal: FixtureFilters["canal"],
): FixtureRow[] {
  if (canal === "ALL") return rows;
  return rows.filter((row) => {
    if (canal === "EV") return row.modelRun?.decision === "BET";
    if (canal === "SV") return row.safeValueBet !== null;
    if (canal === "CONF") return row.prediction !== null;
    if (canal === "DRAW") return row.drawPrediction !== null;
    if (canal === "BTTS") return row.bttsPrediction !== null;
    return true;
  });
}

export function useFixtures(filters: FixtureFilters) {
  const query = useInfiniteQuery({
    queryKey: ["fixtures", filters],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      clientApiRequest<FixturesPage>(
        `/fixture?${buildParams(filters, pageParam).toString()}`,
        { fallbackErrorMessage: "Impossible de charger les fixtures." },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  });

  const allRows = (query.data?.pages ?? []).flatMap((p) =>
    filterByCanal(p.rows, filters.canal),
  );
  const total = query.data?.pages[query.data.pages.length - 1]?.total ?? 0;

  return { ...query, allRows, total };
}
