"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, StatCard, Skeleton } from "@evcore/ui";
import { EvBarChart } from "@/components/charts/ev-bar-chart";
import {
  ChannelStatsTable,
  type ChannelStatRow,
} from "@/app/dashboard/track-record/components/channel-stats-table";
import { channelLabel } from "@/app/dashboard/decisions/components/channel-constants";
import { formatMarketForDisplay } from "@/helpers/fixture";
import { useChannelHealth } from "@/domains/dashboard/use-cases/get-channel-health";
import { useActiveSuspensions } from "@/domains/risk/use-cases/get-active-suspensions";
import { useRecentRiskAlerts } from "@/domains/risk/use-cases/get-recent-risk-alerts";
import { useCalibrationCurve } from "@/domains/risk/use-cases/get-calibration-curve";
import type { ChannelHealthItem } from "@/domains/dashboard/types/dashboard";

type GlobalStatus = "GOOD" | "WATCH" | "ALERT" | "UNKNOWN";

const GLOBAL_STATUS_VARIANT: Record<
  GlobalStatus,
  "success" | "warning" | "destructive" | "neutral"
> = {
  GOOD: "success",
  WATCH: "warning",
  ALERT: "destructive",
  UNKNOWN: "neutral",
};

const GLOBAL_STATUS_LABEL: Record<GlobalStatus, string> = {
  GOOD: "Bon",
  WATCH: "Surveillance",
  ALERT: "Alerte",
  UNKNOWN: "Données insuffisantes",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

// Weighted by sampleSize — a 400-selection channel shouldn't move the
// global figure as much as a 30-selection one at the same ratio.
function weightedCalibrationRatio(items: ChannelHealthItem[]): number | null {
  const withRatio = items.filter(
    (i) => i.calibrationRatio !== null && i.sampleSize > 0,
  );
  if (withRatio.length === 0) return null;
  const totalWeight = withRatio.reduce((acc, i) => acc + i.sampleSize, 0);
  if (totalWeight === 0) return null;
  const weightedSum = withRatio.reduce(
    (acc, i) => acc + (i.calibrationRatio as number) * i.sampleSize,
    0,
  );
  return weightedSum / totalWeight;
}

// Admin-only synthesis of the risk garde-fous (docs/dashboard-operator-
// admin-redesign-2026-09-04.md étape 2) — every figure here reuses an
// existing calculation (channel-health's calibration ratio, risk's
// suspensions/calibration-curve/alerts), nothing recomputed.
export function EngineHealthCard() {
  const locale = useLocale();
  const t = useTranslations("dashboard.engineHealth");

  const { data: health30d = [], isLoading: health30Loading } =
    useChannelHealth(daysAgoIso(30), todayIso());
  const { data: health7d = [], isLoading: health7Loading } = useChannelHealth(
    daysAgoIso(7),
    todayIso(),
  );
  const { data: suspensions = [], isLoading: suspensionsLoading } =
    useActiveSuspensions();
  const { data: alerts = [], isLoading: alertsLoading } =
    useRecentRiskAlerts(7);
  const { data: curve = [], isLoading: curveLoading } = useCalibrationCurve();

  const isLoading =
    health30Loading ||
    health7Loading ||
    suspensionsLoading ||
    alertsLoading ||
    curveLoading;

  const { globalStatus, globalRatio, redCount, trend, rows } = useMemo(() => {
    const ratio30 = weightedCalibrationRatio(health30d);
    const ratio7 = weightedCalibrationRatio(health7d);
    const reds = health30d.filter((h) => h.status === "RED").length;
    const oranges = health30d.filter((h) => h.status === "ORANGE").length;
    const hasData = health30d.some(
      (h) => h.status === "GREEN" || h.status === "ORANGE" || h.status === "RED",
    );

    const status: GlobalStatus = !hasData
      ? "UNKNOWN"
      : reds > 0 || suspensions.length > 0
        ? "ALERT"
        : oranges > 0
          ? "WATCH"
          : "GOOD";

    const statRows: ChannelStatRow[] = [...health30d]
      .filter((h) => h.status !== "INACTIVE")
      .sort((a, b) => {
        const devA =
          a.calibrationRatio === null ? -1 : Math.abs(a.calibrationRatio - 1);
        const devB =
          b.calibrationRatio === null ? -1 : Math.abs(b.calibrationRatio - 1);
        return devB - devA;
      })
      .map((h) => ({
        key: h.channel,
        primaryLabel: channelLabel(h.channel, locale),
        status: h.status,
        roi: h.roi,
        hitRate: h.hitRate,
        calibrationRatio: h.calibrationRatio,
        sampleSize: h.sampleSize,
      }));

    return {
      globalStatus: status,
      globalRatio: ratio30,
      redCount: reds,
      trend: ratio30 !== null && ratio7 !== null ? ratio7 - ratio30 : null,
      rows: statRows,
    };
  }, [health30d, health7d, suspensions.length, locale]);

  const curveData = curve.map((bin) => ({
    bin: `${Math.round(bin.minProb * 100)}-${Math.round(bin.maxProb * 100)}%`,
    annoncee: Math.round(bin.avgProb * 100),
    reelle: Math.round(bin.actualRate * 100),
  }));

  return (
    <section className="ev-shell-shadow rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("headline")}
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
            {t("title")}
          </h2>
        </div>
        {isLoading ? (
          <div className="h-6 w-32 animate-pulse rounded-full bg-secondary" />
        ) : (
          <Badge variant={GLOBAL_STATUS_VARIANT[globalStatus]}>
            {GLOBAL_STATUS_LABEL[globalStatus]}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <StatCard
            label={t("globalRatio")}
            value={globalRatio !== null ? `${globalRatio.toFixed(2)}×` : "—"}
            tone={globalStatus === "ALERT" ? "danger" : "accent"}
            compact
          />
          <StatCard
            label={t("redChannels")}
            value={String(redCount)}
            tone={redCount > 0 ? "danger" : "success"}
            compact
          />
          <StatCard
            label={t("activeSuspensions")}
            value={String(suspensions.length)}
            tone={suspensions.length > 0 ? "danger" : "success"}
            compact
          />
          <StatCard
            label={t("trend")}
            value={
              trend !== null
                ? `${trend >= 0 ? "+" : ""}${trend.toFixed(2)}×`
                : "—"
            }
            delta={t("trendCaption")}
            tone={trend !== null && trend < 0 ? "warning" : "neutral"}
            compact
          />
        </div>
      )}

      {curveData.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-panel p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("calibrationCurve")}
          </p>
          <EvBarChart
            data={curveData}
            xKey="bin"
            bars={[
              { key: "annoncee", color: "var(--muted-foreground)", label: t("announced") },
              { key: "reelle", color: "var(--accent)", label: t("actual") },
            ]}
            formatY={(v) => `${v}%`}
            className="mt-2"
            height={160}
          />
        </div>
      )}

      {suspensions.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-panel p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("suspendedMarkets")}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {suspensions.map((s) => (
              <li key={s.market} className="text-sm">
                <span className="font-medium text-foreground">
                  {formatMarketForDisplay(s.market, locale === "en" ? "en" : "fr")}
                </span>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {s.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-panel p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("recentAlerts")}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {alerts.map((a) => (
              <li key={a.id} className="text-sm text-foreground">
                {a.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("channelsByDeviation")}
          </p>
          <ChannelStatsTable primaryColumnLabel={t("channel")} rows={rows} />
        </div>
      )}
    </section>
  );
}
