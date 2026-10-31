import {
  RESULTS_PERIODS,
  type ResultsPeriod,
  type ResultsScreen,
} from "@/domains/results/types/results";

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
