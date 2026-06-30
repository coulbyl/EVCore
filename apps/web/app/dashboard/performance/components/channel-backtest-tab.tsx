"use client";

import {
  Badge,
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  type ColumnDef,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import {
  channelLabel,
  CHANNEL_COLOR,
} from "@/app/dashboard/decisions/components/channel-constants";
import { useRunChannelBacktest } from "@/domains/backtest/use-cases/run-channel-backtest";
import type { ChannelBacktestReport } from "@/domains/backtest/types/channel-backtest";
import {
  ANALYSIS_STORAGE_KEY,
  formatPct,
  formatSignedPct,
  roiToneClass,
} from "./analysis-constants";
import { AnalysisRunBar } from "./analysis-run-bar";
import { useStoredResult } from "./use-stored-result";
import { VerdictBadge } from "./verdict-badge";

export function ChannelBacktestTab() {
  const t = useTranslations("performancePage");
  const tc = useTranslations("decisions");
  const common = useTranslations("common");
  const mutation = useRunChannelBacktest();
  const { result } = useStoredResult(
    mutation.data,
    ANALYSIS_STORAGE_KEY.channels,
  );

  const columns: ColumnDef<ChannelBacktestReport>[] = [
    {
      id: "channel",
      header: t("colChannel"),
      accessorFn: (r) => r.channel,
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className="text-[0.62rem] font-semibold"
          style={{
            borderColor: CHANNEL_COLOR[row.original.channel],
            color: CHANNEL_COLOR[row.original.channel],
          }}
        >
          {channelLabel(row.original.channel, tc)}
        </Badge>
      ),
    },
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
      id: "total",
      header: t("colSettled"),
      accessorFn: (r) => r.total,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.total}</span>
      ),
    },
    {
      id: "hitRate",
      header: t("colHitRate"),
      accessorFn: (r) => r.hitRate,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">{formatPct(row.original.hitRate)}</span>
      ),
    },
    {
      id: "roi",
      header: t("colRoi"),
      accessorFn: (r) => r.roi,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span
          className={`tabular-nums font-semibold ${roiToneClass(row.original.roi)}`}
        >
          {formatSignedPct(row.original.roi)}
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
      <p className="text-sm text-muted-foreground">{t("channelsHint")}</p>
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
          initialSorting={[{ id: "roi", desc: true }]}
          mobileCard={(report) => (
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-0">
              <div className="min-w-0">
                <Badge
                  variant="outline"
                  className="text-[0.6rem] font-semibold"
                  style={{
                    borderColor: CHANNEL_COLOR[report.channel],
                    color: CHANNEL_COLOR[report.channel],
                  }}
                >
                  {channelLabel(report.channel, tc)}
                </Badge>
                <p className="mt-1 text-xs font-semibold text-foreground">
                  {report.competitionCode}
                </p>
                <p className="text-[0.65rem] text-muted-foreground">
                  {report.total} · {formatPct(report.hitRate)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
                <span className={`font-semibold ${roiToneClass(report.roi)}`}>
                  {formatSignedPct(report.roi)}
                </span>
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
