import { cache } from "react";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api/shared";
import { serverApiRequest } from "@/lib/api/server-api";
import type { TodayCoupon } from "@/domains/today/types/today";
import type {
  AiDetail,
  ProductDetail,
  WeekScreen,
  YesterdayScreen,
  ResultsPeriod,
  ResultsProductKey,
} from "../types/results";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A read the API answers 404 to (unknown product or coupon): not found. */
export async function orNotFound<T>(read: Promise<T>): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

/** A product opened in Résultats (08 § 2), read once per request. */
export const getProductDetail = cache(
  (product: ResultsProductKey, period: ResultsPeriod): Promise<ProductDetail> =>
    orNotFound(
      serverApiRequest<ProductDetail>(
        `/results/products/${product}?period=${period}`,
      ),
    ),
);

/** « Avis IA » opened (08 § 2), read once per request. */
export const getAiDetail = cache(
  (period: ResultsPeriod): Promise<AiDetail> =>
    serverApiRequest<AiDetail>(`/results/ai?period=${period}`),
);

/** A published coupon of any day, opened from « Jour par jour ». */
export const getResultsCoupon = cache((id: string): Promise<TodayCoupon> => {
  if (!UUID.test(id)) notFound();
  return orNotFound(
    serverApiRequest<TodayCoupon>(`/results/coupons/${encodeURIComponent(id)}`),
  );
});

/** Yesterday's coupons, all, settled (08 § 3). */
export const getYesterday = cache(
  (): Promise<YesterdayScreen> =>
    serverApiRequest<YesterdayScreen>("/results/yesterday"),
);

/** « Ta semaine »: the week closed last Sunday (08 § 3). */
export const getWeek = cache(
  (): Promise<WeekScreen> => serverApiRequest<WeekScreen>("/results/week"),
);
