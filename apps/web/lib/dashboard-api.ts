import type {
  CouponPeriodResponse,
  CouponSnapshot,
} from "@/domains/dashboard/types/dashboard";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
