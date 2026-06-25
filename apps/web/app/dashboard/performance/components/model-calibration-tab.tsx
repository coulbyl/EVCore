"use client";

import {
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  type ColumnDef,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import { useRunModelCalibration } from "@/domains/backtest/use-cases/run-channel-backtest";
import type { ModelCalibrationReport } from "@/domains/backtest/types/channel-backtest";
import { formatDecimal } from "./formatters";
import { ANALYSIS_STORAGE_KEY, formatPct } from "./analysis-constants";
import { AnalysisRunBar } from "./analysis-run-bar";
import { useStoredResult } from "./use-stored-result";
import { VerdictBadge } from "./verdict-badge";

export function ModelCalibrationTab() {
  const t = useTranslations("performancePage");
  const common = useTranslations("common");
  const mutation = useRunModelCalibration();
  const { result } = useStoredResult(
    mutation.data,
    ANALYSIS_STORAGE_KEY.calibration,
  );

  const columns: ColumnDef<ModelCalibrationReport>[] = [
    {
      id: "competition",
      header: t("colCompetition"),
      accessorFn: (r) => r.competitionCode,
      cell: ({ row }) => (
        <span className="text-xs font-medium text-foreground">
          {row.original.competitionCode}
        </span>
      ),
    },
    {
      id: "analyzed",
      header: t("colAnalyzed"),
      accessorFn: (r) => r.analyzedCount,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.analyzedCount}</span>
      ),
    },
    {
      id: "brier",
      header: t("stats.brierScore"),
      accessorFn: (r) => r.brierScore,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatDecimal(row.original.brierScore, 3)}
        </span>
      ),
    },
    {
      id: "ece",
      header: t("colEce"),
      accessorFn: (r) => r.calibrationError,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatPct(row.original.calibrationError)}
        </span>
      ),
    },
    {
      id: "verdict",
      header: t("colVerdict"),
      accessorFn: (r) => r.verdict,
      meta: { align: "right" },
      cell: ({ row }) => <VerdictBadge verdict={row.original.verdict} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("calibrationModelHint")}
      </p>
      <AnalysisRunBar
        isPending={mutation.isPending}
        onRun={() => mutation.mutate()}
        window={result ? { from: result.from, to: result.to } : null}
      />

      {mutation.error ? (
        <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
          <EmptyHeader>
            <EmptyTitle>{common("error")}</EmptyTitle>
            <EmptyDescription>
              {mutation.error instanceof Error
                ? mutation.error.message
                : common("error")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {result && result.reports.length > 0 ? (
        <DataTable
          columns={columns}
          data={result.reports}
          initialSorting={[{ id: "brier", desc: false }]}
          mobileCard={(report) => (
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-0">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  {report.competitionCode}
                </p>
                <p className="text-[0.65rem] text-muted-foreground">
                  {report.analyzedCount} · {formatPct(report.calibrationError)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
                <span>{formatDecimal(report.brierScore, 3)}</span>
                <VerdictBadge verdict={report.verdict} />
              </div>
            </div>
          )}
        />
      ) : result ? (
        <p className="text-sm text-muted-foreground">{t("analysisEmpty")}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t("analysisIdle")}</p>
      )}
    </div>
  );
}
