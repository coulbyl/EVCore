"use client";

import { Button, DateRangePicker, type DateRange } from "@evcore/ui";
import { Loader2, Play } from "lucide-react";
import { useTranslations } from "next-intl";

/** Run button + window picker/note shared by every analysis tab. Defaults to
 * the backend's own 1-year default when `range` is left unset — picking a
 * range here is optional, it lets a tab re-run on a shorter/longer window
 * instead of always the default. */
export function AnalysisRunBar({
  isPending,
  onRun,
  window,
  range,
  onRangeChange,
}: {
  isPending: boolean;
  onRun: () => void;
  /** Optional `{ from, to }` window covered by the loaded result. */
  window?: { from: string; to: string } | null;
  /** Controlled date range for the next run — omit to hide the picker. */
  range?: DateRange | undefined;
  onRangeChange?: (range: DateRange | undefined) => void;
}) {
  const t = useTranslations("performancePage");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {window ? (
        <p className="text-xs text-muted-foreground">
          {t("analysisWindow", { from: window.from, to: window.to })}
        </p>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {onRangeChange ? (
          <DateRangePicker
            value={range}
            onChange={onRangeChange}
            placeholder={t("analysisWindowPicker")}
            className="h-8 w-auto text-xs"
            disabled={isPending}
          />
        ) : null}
        <Button
          type="button"
          size="sm"
          className="gap-2"
          disabled={isPending}
          onClick={onRun}
        >
          {isPending ? (
            <>
              <Loader2 data-icon="inline-start" className="animate-spin" />
              {t("backtestRunning")}
            </>
          ) : (
            <>
              <Play data-icon="inline-start" />
              {t("runAnalysis")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
