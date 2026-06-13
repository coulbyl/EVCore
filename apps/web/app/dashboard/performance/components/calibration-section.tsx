"use client";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  StatList,
  TableCard,
} from "@evcore/ui";
import type { StatListItem } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { EvLineChart, EvScatterChart } from "@/components/charts";
import { CHART_COLORS } from "@/components/charts/chart-theme";
import { useAdjustmentProposals } from "@/domains/adjustment/use-cases/get-adjustment-proposals";
import { useCalibrationCurve } from "@/domains/risk/use-cases/get-calibration-curve";
import { formatDateShort } from "@/lib/date";
import { formatDecimal, toNumber } from "./formatters";

function getCalibrationDriftState(current: number, previous?: number) {
  if (previous === undefined) {
    return "neutral" as const;
  }

  if (current <= previous) {
    return "healthy" as const;
  }

  return "warning" as const;
}

function CalibrationTrend({
  current,
  previous,
}: {
  current: number;
  previous: number | undefined;
}) {
  if (previous === undefined) return null;
  const delta = current - previous;
  const improved = delta < 0;
  const sign = improved ? "↓" : "↑";
  const colorClass = improved ? "text-success" : "text-danger";
  return (
    <span className={`ml-2 text-xs font-semibold tabular-nums ${colorClass}`}>
      {sign} {Math.abs(delta).toFixed(3)}
    </span>
  );
}

export function CalibrationSection() {
  const t = useTranslations("performancePage");
  const common = useTranslations("common");
  const { data, error, isLoading } = useAdjustmentProposals();
  const { data: calibrationBins } = useCalibrationCurve();

  const applied = (data ?? []).filter(
    (proposal) => proposal.status === "APPLIED",
  );
  const latestApplied = applied[0];
  const previousApplied = applied[1];
  const latestCalibrationError = toNumber(latestApplied?.calibrationError);
  const previousCalibrationError = toNumber(previousApplied?.calibrationError);
  const driftState = latestCalibrationError !== null
    ? getCalibrationDriftState(
        latestCalibrationError,
        previousCalibrationError ?? undefined,
      )
    : "neutral";

  const chartData = [...applied]
    .reverse()
    .map((proposal) => {
      const calibrationError = toNumber(proposal.calibrationError);
      if (calibrationError === null) return null;

      return {
        date: formatDateShort(proposal.createdAt),
        brierScore: calibrationError,
      };
    })
    .filter((proposal): proposal is { date: string; brierScore: number } =>
      proposal !== null,
    );

  const statItems: StatListItem[] = latestApplied
    ? [
        {
          label: t("factors.recentForm"),
          value: formatDecimal(latestApplied.proposedWeights.recentForm, 3),
        },
        {
          label: t("factors.xg"),
          value: formatDecimal(latestApplied.proposedWeights.xg, 3),
        },
        {
          label: t("factors.domExtPerf"),
          value: formatDecimal(latestApplied.proposedWeights.domExtPerf, 3),
        },
        {
          label: t("factors.leagueVolat"),
          value: formatDecimal(latestApplied.proposedWeights.leagueVolat, 3),
        },
      ]
    : [];

  const scatterDatasets =
    calibrationBins && calibrationBins.length > 0
      ? [
          {
            key: "calibration",
            label: t("reliabilityDiagram"),
            color: CHART_COLORS.teal,
            data: calibrationBins.map((bin) => ({
              x: bin.avgProb,
              y: bin.actualRate,
              count: bin.count,
            })),
          },
        ]
      : [];

  return (
    <TableCard title={t("calibration")} subtitle={t("calibrationHint")}>
      <div className="flex flex-col gap-5 p-4 sm:p-5">
        {error ? (
          <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
            <EmptyHeader>
              <EmptyTitle>{common("error")}</EmptyTitle>
              <EmptyDescription>
                {error instanceof Error ? error.message : common("error")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : chartData.length === 0 ? (
          <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
            <EmptyHeader>
              <EmptyTitle>{t("noCalibrationData")}</EmptyTitle>
              <EmptyDescription>{t("calibrationHint")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <EvLineChart
            data={chartData}
            xKey="date"
            height={220}
            formatY={(value) => Number(value).toFixed(2)}
            lines={[
              {
                key: "brierScore",
                color: CHART_COLORS.amber,
                label: t("stats.calibrationError"),
              },
            ]}
          />
        )}

        {latestApplied && latestCalibrationError !== null && (
          <div
            className={[
              "rounded-[1.2rem] border bg-panel px-4 py-3",
              driftState === "warning"
                ? "border-warning/40 bg-warning/5"
                : "border-border",
            ].join(" ")}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("latestBrierScore")}
              </p>
              <div className="flex items-baseline">
                <span
                  className={[
                    "tabular-nums text-sm font-semibold",
                    driftState === "warning"
                      ? "text-warning"
                      : "text-foreground",
                  ].join(" ")}
                >
                  {latestCalibrationError.toFixed(3)}
                </span>
                <CalibrationTrend
                  current={latestCalibrationError}
                  previous={previousCalibrationError ?? undefined}
                />
              </div>
            </div>
            {driftState === "warning" && (
              <p className="mt-2 text-xs text-warning">
                Drift détecté: la calibration se dégrade par rapport à la
                recalibration précédente.
              </p>
            )}
          </div>
        )}

        {scatterDatasets.length > 0 && (
          <div className="rounded-[1.2rem] border border-border bg-panel px-4 py-4">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("reliabilityDiagram")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("reliabilityDiagramHint")}
            </p>
            <EvScatterChart
              datasets={scatterDatasets}
              xLabel={t("reliabilityX")}
              yLabel={t("reliabilityY")}
              height={220}
              showDiagonal
              formatX={(v) => `${(v * 100).toFixed(0)}%`}
              formatY={(v) => `${(v * 100).toFixed(0)}%`}
              className="mt-4"
            />
          </div>
        )}

        <div className="rounded-[1.2rem] border border-border bg-panel px-4 py-3">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("currentWeights")}
          </p>
          {isLoading && statItems.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {common("loading")}
            </p>
          ) : statItems.length > 0 ? (
            <StatList items={statItems} className="mt-3" />
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("noCalibrationData")}
            </p>
          )}
        </div>
      </div>
    </TableCard>
  );
}
