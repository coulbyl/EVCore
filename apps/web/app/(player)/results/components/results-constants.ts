import {
  RESULTS_PERIODS,
  RESULTS_PRODUCT_KEYS,
  type ResultsPeriod,
  type ResultsProductKey,
  type ResultsScreen,
} from "@/domains/results/types/results";

/** The AI's sheet, beside the products' (08 § 2). */
export const AI_SLUG = "ai";
/** The sheets the « Hier » line opens (08 § 3). */
export const YESTERDAY_SLUG = "yesterday";
export const WEEK_SLUG = "week";

/** « /results/favourite », « /results/hunter-draw ». */
export function productSlug(product: ResultsProductKey): string {
  return product.toLowerCase().replace(/_/g, "-");
}

/** The product of a sheet's address, the AI, or null when unknown. */
export function sheetOf(
  slug: string,
):
  | { kind: "ai" }
  | { kind: "yesterday" }
  | { kind: "week" }
  | { kind: "product"; product: ResultsProductKey }
  | null {
  if (slug === AI_SLUG) return { kind: "ai" };
  if (slug === YESTERDAY_SLUG) return { kind: "yesterday" };
  if (slug === WEEK_SLUG) return { kind: "week" };
  const product = RESULTS_PRODUCT_KEYS.find((key) => productSlug(key) === slug);
  return product ? { kind: "product", product } : null;
}

/** A sheet's address, keeping the period chosen on the list. */
export function sheetHref(slug: string, period: ResultsPeriod): string {
  return period === "90"
    ? `/results/${slug}`
    : `/results/${slug}?period=${period}`;
}

/** The period chip of the address, 90 days when absent or unknown (08 § 1). */
export function periodOf(param: string | string[] | undefined): ResultsPeriod {
  const value = Array.isArray(param) ? param[0] : param;
  return RESULTS_PERIODS.find((period) => period === value) ?? "90";
}

export function periodHref(period: ResultsPeriod): string {
  return period === "90" ? "/results" : `/results?period=${period}`;
}

/**
 * « depuis le 13/10 » under the lines: the earliest day counted on the
 * screen; each line counts from its own launch, never before (08 § 6).
 */
export function earliestSince(screen: ResultsScreen): string | null {
  const dates = [
    ...screen.products.map((product) => product.since),
    ...(screen.ai.since ? [screen.ai.since] : []),
  ].sort();
  return dates[0] ?? null;
}
