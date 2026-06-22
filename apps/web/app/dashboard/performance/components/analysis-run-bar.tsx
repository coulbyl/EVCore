"use client";

import { Button } from "@evcore/ui";
import { Loader2, Play } from "lucide-react";
import { useTranslations } from "next-intl";

/** Run button + window note shared by every analysis tab. */
export function AnalysisRunBar({
  isPending,
  onRun,
  window,
}: {
  isPending: boolean;
  onRun: () => void;
  /** Optional `{ from, to }` window covered by the loaded result. */
  window?: { from: string; to: string } | null;
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
  );
}
