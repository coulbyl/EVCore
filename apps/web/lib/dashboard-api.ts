import type {
  CouponPeriodResponse,
  CouponSnapshot,
  DashboardSummary,
} from "../types/dashboard";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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

export async function fetchDashboardSummary(
  pnlDate?: string,
): Promise<DashboardSummary> {
  const params = pnlDate ? `?pnlDate=${pnlDate}` : "";
  const response = await fetch(`${BACKEND_URL}/dashboard/summary${params}`);

  if (!response.ok) {
    throw new Error(`Impossible de charger le dashboard (${response.status})`);
  }

  return (await response.json()) as DashboardSummary;
}

export async function fetchCouponsByPeriod(params: {
  from: string;
  to: string;
  query?: string;
  status?: "PENDING" | "WON" | "LOST";
}): Promise<CouponPeriodResponse> {
  const search = new URLSearchParams({ from: params.from, to: params.to });
  if (params.query && params.query.trim() !== "") {
    search.set("query", params.query.trim());
  }
  if (params.status) {
    search.set("status", params.status);
  }
  const response = await fetch(`${BACKEND_URL}/coupon?${search.toString()}`);

  if (!response.ok) {
    throw new Error(`Impossible de charger les coupons (${response.status})`);
  }

  return (await response.json()) as CouponPeriodResponse;
}

export async function fetchCouponById(
  id: string,
): Promise<CouponSnapshot | null> {
  const response = await fetch(`${BACKEND_URL}/coupon/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Impossible de charger le coupon (${response.status})`);
  }
  return (await response.json()) as CouponSnapshot;
}

