import type { DashboardSummary } from "../types/dashboard";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch(`${BACKEND_URL}/dashboard/summary`);

  if (!response.ok) {
    throw new Error(`Impossible de charger le dashboard (${response.status})`);
  }

  return (await response.json()) as DashboardSummary;
}
