"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { FixtureFilters, FixtureRow } from "../types/fixture";

type FixturesResponse = {
  rows: FixtureRow[];
  total: number;
};

function buildParams(filters: FixtureFilters): URLSearchParams {
  const params = new URLSearchParams({ date: filters.date });
  if (filters.competition !== "ALL")
    params.set("competition", filters.competition);
  if (filters.decision !== "ALL") params.set("decision", filters.decision);
  if (filters.status !== "ALL") params.set("status", filters.status);
  if (filters.timeSlot !== "ALL") params.set("timeSlot", filters.timeSlot);
  if (filters.betStatus !== "ALL") params.set("betStatus", filters.betStatus);
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
  const query = useQuery({
    queryKey: ["fixtures", filters],
    queryFn: () =>
      clientApiRequest<FixturesResponse>(
        `/fixture?${buildParams(filters).toString()}`,
        { fallbackErrorMessage: "Impossible de charger les fixtures." },
      ),
    staleTime: 30_000,
  });

  const allRows = filterByCanal(query.data?.rows ?? [], filters.canal);
  const total = query.data?.total ?? 0;

  return { ...query, allRows, total };
}
