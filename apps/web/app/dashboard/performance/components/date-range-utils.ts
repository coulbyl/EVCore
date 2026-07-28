import { format } from "date-fns";
import type { DateRange } from "@evcore/ui";
import type { AnalysisWindowParams } from "@/domains/backtest/use-cases/run-channel-backtest";

/** YYYY-MM-DD, matches the backend's parseIsoDate. */
function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Converts a picker range to the API's optional {from, to} — undefined when
 * no range was picked, letting the backend fall back to its own default
 * (1 year). */
export function toIsoDateParam(
  range: DateRange | undefined,
): AnalysisWindowParams | undefined {
  if (!range?.from) return undefined;
  return {
    from: toIsoDate(range.from),
    to: toIsoDate(range.to ?? range.from),
  };
}
