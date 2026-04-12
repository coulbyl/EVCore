import type { FixtureFilters, FixtureRow } from "../types/fixture";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type FixturesResult = { rows: FixtureRow[]; total: number };

/** Récupère les fixtures depuis le backend avec tous les filtres appliqués côté serveur.
 *  Endpoint : GET /fixture (fixture module — single responsibility) */
export async function getFixtures(
  filters: FixtureFilters,
): Promise<FixturesResult> {
  const params = new URLSearchParams({ date: filters.date });

  if (filters.competition !== "ALL")
    params.set("competition", filters.competition);
  if (filters.decision !== "ALL") params.set("decision", filters.decision);
  if (filters.status !== "ALL") params.set("status", filters.status);
  if (filters.timeSlot !== "ALL") params.set("timeSlot", filters.timeSlot);
  if (filters.betStatus !== "ALL") params.set("betStatus", filters.betStatus);

  const response = await fetch(`${BACKEND_URL}/fixture?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Impossible de charger les fixtures (${response.status})`);
  }

  return (await response.json()) as FixturesResult;
}
