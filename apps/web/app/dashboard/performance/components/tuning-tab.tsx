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
import { useRunChannelTuning } from "@/domains/backtest/use-cases/run-channel-backtest";
import type {
  BttsNoTuningReport,
  ChannelTuningReport,
  GoalsTuningReport,
} from "@/domains/backtest/types/channel-backtest";
import {
  ANALYSIS_STORAGE_KEY,
  formatPct,
  formatSignedPct,
  roiToneClass,
} from "./analysis-constants";
import { AnalysisRunBar } from "./analysis-run-bar";
import { useStoredResult } from "./use-stored-result";

function formatThreshold(value: number): string {
  return value.toFixed(2);
}

export function TuningTab() {
  const t = useTranslations("performancePage");
  const tc = useTranslations("decisions");
  const common = useTranslations("common");
  const mutation = useRunChannelTuning();
  const { result } = useStoredResult(
    mutation.data,
    ANALYSIS_STORAGE_KEY.tuning,
  );
  // Older stored results predate goalsReports/bttsNoReports — default to empty.
  const goalsReports = result?.goalsReports ?? [];
  const bttsNoReports = result?.bttsNoReports ?? [];

  const columns: ColumnDef<ChannelTuningReport>[] = [
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
      id: "current",
      header: t("colCurrent"),
      accessorFn: (r) => r.current.threshold,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span
          className={`tabular-nums ${row.original.current.enabled ? "text-foreground" : "text-muted-foreground line-through"}`}
        >
          {formatThreshold(row.original.current.threshold)}
        </span>
      ),
    },
    {
      id: "recommended",
      header: t("colRecommended"),
      accessorFn: (r) => r.recommended?.threshold ?? -1,
      meta: { align: "right" },
      cell: ({ row }) => {
        const rec = row.original.recommended;
        if (!rec) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        const changed = rec.threshold !== row.original.current.threshold;
        return (
          <span
            className={`tabular-nums font-semibold ${changed ? "text-accent" : "text-foreground"}`}
          >
            {formatThreshold(rec.threshold)}
          </span>
        );
      },
    },
    {
      id: "recRoi",
      header: t("colRecRoi"),
      accessorFn: (r) => r.recommended?.roi ?? Number.NEGATIVE_INFINITY,
      meta: { align: "right" },
      cell: ({ row }) => {
        const rec = row.original.recommended;
        if (!rec) return <span className="text-muted-foreground">—</span>;
        return (
          <span
            className={`tabular-nums font-semibold ${roiToneClass(rec.roi)}`}
          >
            {formatSignedPct(rec.roi)}
          </span>
        );
      },
    },
    {
      id: "recSample",
      header: t("colRecSample"),
      accessorFn: (r) => r.recommended?.total ?? 0,
      meta: { align: "right" },
      cell: ({ row }) => {
        const rec = row.original.recommended;
        if (!rec) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="tabular-nums text-muted-foreground">
            {rec.total} · {formatPct(rec.hitRate)}
          </span>
        );
      },
    },
  ];

  const goalsColumns: ColumnDef<GoalsTuningReport>[] = [
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
      id: "segment",
      header: t("colSegment"),
      accessorFn: (r) => `${r.line}-${r.side}`,
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className="text-[0.62rem] font-semibold"
          style={{
            borderColor: CHANNEL_COLOR.GOALS,
            color: CHANNEL_COLOR.GOALS,
          }}
        >
          {row.original.side === "OVER" ? "+" : "−"}
          {formatThreshold(row.original.line)}
        </Badge>
      ),
    },
    {
      id: "current",
      header: t("colCurrent"),
      accessorFn: (r) => r.current?.threshold ?? -1,
      meta: { align: "right" },
      cell: ({ row }) => {
        const current = row.original.current;
        if (!current) return <span className="text-muted-foreground">—</span>;
        return (
          <span
            className={`tabular-nums ${current.enabled ? "text-foreground" : "text-muted-foreground line-through"}`}
          >
            {formatThreshold(current.threshold)}
          </span>
        );
      },
    },
    {
      id: "recommended",
      header: t("colRecommended"),
      accessorFn: (r) => r.recommended?.threshold ?? -1,
      meta: { align: "right" },
      cell: ({ row }) => {
        const rec = row.original.recommended;
        if (!rec)
          return <span className="text-xs text-muted-foreground">—</span>;
        const changed = rec.threshold !== row.original.current?.threshold;
        return (
          <span
            className={`tabular-nums font-semibold ${changed ? "text-accent" : "text-foreground"}`}
          >
            {formatThreshold(rec.threshold)}
          </span>
        );
      },
    },
    {
      id: "recRoi",
      header: t("colRecRoi"),
      accessorFn: (r) => r.recommended?.roi ?? Number.NEGATIVE_INFINITY,
      meta: { align: "right" },
      cell: ({ row }) => {
        const rec = row.original.recommended;
        if (!rec) return <span className="text-muted-foreground">—</span>;
        return (
          <span
            className={`tabular-nums font-semibold ${roiToneClass(rec.roi)}`}
          >
            {formatSignedPct(rec.roi)}
          </span>
        );
      },
    },
    {
      id: "recSample",
      header: t("colRecSample"),
      accessorFn: (r) => r.recommended?.total ?? 0,
      meta: { align: "right" },
      cell: ({ row }) => {
        const rec = row.original.recommended;
        if (!rec) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="tabular-nums text-muted-foreground">
            {rec.total} · {formatPct(rec.hitRate)}
          </span>
        );
      },
    },
  ];

  const bttsNoColumns: ColumnDef<BttsNoTuningReport>[] = [
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
      id: "current",
      header: t("colCurrent"),
      accessorFn: (r) => r.current.threshold,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span
          className={`tabular-nums ${row.original.current.enabled ? "text-foreground" : "text-muted-foreground line-through"}`}
        >
          {formatThreshold(row.original.current.threshold)}
        </span>
      ),
    },
    {
      id: "recommended",
      header: t("colRecommended"),
      accessorFn: (r) => r.recommended?.threshold ?? -1,
      meta: { align: "right" },
      cell: ({ row }) => {
        const rec = row.original.recommended;
        if (!rec)
          return <span className="text-xs text-muted-foreground">—</span>;
        const changed = rec.threshold !== row.original.current.threshold;
        return (
          <span
            className={`tabular-nums font-semibold ${changed ? "text-accent" : "text-foreground"}`}
          >
            {formatThreshold(rec.threshold)}
          </span>
        );
      },
    },
    {
      id: "recRoi",
      header: t("colRecRoi"),
      accessorFn: (r) => r.recommended?.roi ?? Number.NEGATIVE_INFINITY,
      meta: { align: "right" },
      cell: ({ row }) => {
        const rec = row.original.recommended;
        if (!rec) return <span className="text-muted-foreground">—</span>;
        return (
          <span
            className={`tabular-nums font-semibold ${roiToneClass(rec.roi)}`}
          >
            {formatSignedPct(rec.roi)}
          </span>
        );
      },
    },
    {
      id: "recSample",
      header: t("colRecSample"),
      accessorFn: (r) => r.recommended?.total ?? 0,
      meta: { align: "right" },
      cell: ({ row }) => {
        const rec = row.original.recommended;
        if (!rec) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="tabular-nums text-muted-foreground">
            {rec.total} · {formatPct(rec.hitRate)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("tuningHint")}</p>
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

      {!result ? (
        <p className="text-sm text-muted-foreground">{t("analysisIdle")}</p>
      ) : result.reports.length === 0 &&
        goalsReports.length === 0 &&
        bttsNoReports.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("analysisEmpty")}</p>
      ) : (
        <>
          {result.reports.length > 0 ? (
            <DataTable
              columns={columns}
              data={result.reports}
              initialSorting={[{ id: "recRoi", desc: true }]}
              mobileCard={(report) => {
                const rec = report.recommended;
                return (
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
                        {t("colCurrent")}:{" "}
                        {formatThreshold(report.current.threshold)}
                        {" → "}
                        {rec ? formatThreshold(rec.threshold) : "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs tabular-nums">
                      {rec ? (
                        <>
                          <span
                            className={`font-semibold ${roiToneClass(rec.roi)}`}
                          >
                            {formatSignedPct(rec.roi)}
                          </span>
                          <p className="text-[0.65rem] text-muted-foreground">
                            {rec.total} · {formatPct(rec.hitRate)}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                );
              }}
            />
          ) : null}
          {goalsReports.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("goalsSection")}
              </h3>
              <DataTable
                columns={goalsColumns}
                data={goalsReports}
                initialSorting={[{ id: "recRoi", desc: true }]}
                mobileCard={(report) => {
                  const rec = report.recommended;
                  return (
                    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-0">
                      <div className="min-w-0">
                        <Badge
                          variant="outline"
                          className="text-[0.6rem] font-semibold"
                          style={{
                            borderColor: CHANNEL_COLOR.GOALS,
                            color: CHANNEL_COLOR.GOALS,
                          }}
                        >
                          {report.side === "OVER" ? "+" : "−"}
                          {formatThreshold(report.line)}
                        </Badge>
                        <p className="mt-1 text-xs font-semibold text-foreground">
                          {report.competitionCode}
                        </p>
                        <p className="text-[0.65rem] text-muted-foreground">
                          {t("colCurrent")}:{" "}
                          {report.current
                            ? formatThreshold(report.current.threshold)
                            : "—"}
                          {" → "}
                          {rec ? formatThreshold(rec.threshold) : "—"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs tabular-nums">
                        {rec ? (
                          <>
                            <span
                              className={`font-semibold ${roiToneClass(rec.roi)}`}
                            >
                              {formatSignedPct(rec.roi)}
                            </span>
                            <p className="text-[0.65rem] text-muted-foreground">
                              {rec.total} · {formatPct(rec.hitRate)}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
            </section>
          ) : null}
          {bttsNoReports.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("bttsNoSection")}
              </h3>
              <DataTable
                columns={bttsNoColumns}
                data={bttsNoReports}
                initialSorting={[{ id: "recRoi", desc: true }]}
                mobileCard={(report) => {
                  const rec = report.recommended;
                  return (
                    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-0">
                      <div className="min-w-0">
                        <Badge
                          variant="outline"
                          className="text-[0.6rem] font-semibold"
                          style={{
                            borderColor: CHANNEL_COLOR.BTTS,
                            color: CHANNEL_COLOR.BTTS,
                          }}
                        >
                          {channelLabel("BTTS", tc)} NO
                        </Badge>
                        <p className="mt-1 text-xs font-semibold text-foreground">
                          {report.competitionCode}
                        </p>
                        <p className="text-[0.65rem] text-muted-foreground">
                          {t("colCurrent")}:{" "}
                          {formatThreshold(report.current.threshold)}
                          {" → "}
                          {rec ? formatThreshold(rec.threshold) : "—"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs tabular-nums">
                        {rec ? (
                          <>
                            <span
                              className={`font-semibold ${roiToneClass(rec.roi)}`}
                            >
                              {formatSignedPct(rec.roi)}
                            </span>
                            <p className="text-[0.65rem] text-muted-foreground">
                              {rec.total} · {formatPct(rec.hitRate)}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
