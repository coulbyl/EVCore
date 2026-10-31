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

/** The tab, or /resultats for a visitor (11 § 1): the same lines. */
export type ResultsBase = "/results" | "/resultats";

/** A sheet's address, keeping the period chosen on the list. */
export function sheetHref(
  slug: string,
  period: ResultsPeriod,
  base: ResultsBase = "/results",
): string {
  return period === "90"
    ? `${base}/${slug}`
    : `${base}/${slug}?period=${period}`;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A real day « 2026-10-13 » (« 2026-02-30 » is not one), else null. */
function dayOf(value: string | undefined): string | null {
  if (!value || !DAY_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

/** The player's dates as a period, « from..to », or null if not a range. */
export function rangeOf(
  from: string | undefined,
  to: string | undefined,
): ResultsPeriod | null {
  const first = dayOf(from);
  const last = dayOf(to);
  if (!first || !last || first > last) return null;
  return `${first}..${last}`;
}

/** The two days of the player's dates, or null for 30 j · 90 j · Tout. */
export function rangeDays(
  period: ResultsPeriod,
): { from: string; to: string } | null {
  const [from, to] = period.split("..");
  return from && to ? { from, to } : null;
}

/**
 * The period of the address, 90 days when absent or unknown (08 § 1): a
 * chip, or the player's dates, as « period=from..to » (a link) or as
 * « from » and « to » (the dates form).
 */
export function periodOf(
  param: string | string[] | undefined,
  form?: { from?: string | string[]; to?: string | string[] },
): ResultsPeriod {
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const fromForm = form ? rangeOf(first(form.from), first(form.to)) : null;
  if (fromForm) return fromForm;
  const value = first(param);
  const preset = RESULTS_PERIODS.find((period) => period === value);
  if (preset) return preset;
  const [from, to] = (value ?? "").split("..");
  return rangeOf(from, to) ?? "90";
}

export function periodHref(
  period: ResultsPeriod,
  base: ResultsBase = "/results",
): string {
  return period === "90" ? base : `${base}?period=${period}`;
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
