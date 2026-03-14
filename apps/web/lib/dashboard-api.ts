import type { DashboardSummary } from "../types/dashboard";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export async function declareFixtureResult(
  fixtureId: string,
  body: {
    homeScore: number;
    awayScore: number;
    homeHtScore?: number;
    awayHtScore?: number;
  },
): Promise<void> {
  const response = await fetch(
    `${BACKEND_URL}/adjustment/fixture/${fixtureId}/result`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erreur ${response.status}: ${text}`);
  }
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch(`${BACKEND_URL}/dashboard/summary`);

  if (!response.ok) {
    throw new Error(`Impossible de charger le dashboard (${response.status})`);
  }

  return (await response.json()) as DashboardSummary;
}
