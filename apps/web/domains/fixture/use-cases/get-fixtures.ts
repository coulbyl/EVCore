import type { FixtureFilters, FixtureRow } from "../types/fixture";
import { serverApiRequest } from "@/lib/api/server-api";

export type FixturesResult = { rows: FixtureRow[]; total: number };

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

  const result = await serverApiRequest<FixturesResult>(
    `/fixture?${params.toString()}`,
    { fallbackErrorMessage: "Impossible de charger les fixtures." },
  );

  const rows = filterByCanal(result.rows, filters.canal);
  return { rows, total: result.total };
}
