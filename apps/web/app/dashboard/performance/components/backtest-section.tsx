"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  StatCard,
  TableCard,
} from "@evcore/ui";
import { Loader2, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { EvBarChart } from "@/components/charts";
import { CHART_COLORS } from "@/components/charts/chart-theme";
import type {
  BacktestResponse,
  BacktestMarketPerformance,
  CompetitionBacktestReport,
} from "@/domains/backtest/types/backtest";
import { formatMarketForDisplay } from "@/helpers/fixture";
import { useRunBacktest } from "@/domains/backtest/use-cases/run-backtest";
import { formatDateLong, formatTime } from "@/lib/date";
import {
  formatDecimal,
  formatInteger,
  formatUnits,
  toNumber,
} from "./formatters";

const STORAGE_KEY = "evcore:performance-backtest-result";

function formatBacktestPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const scaled = value * 100;
  return `${scaled > 0 ? "+" : ""}${scaled.toFixed(digits)}%`;
}

function loadStoredBacktest(): BacktestResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BacktestResponse;
  } catch {
    return null;
  }
}

function saveStoredBacktest(report: BacktestResponse): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
  } catch {
    // localStorage non disponible
  }
}

function aggregateBacktestReports(reports: CompetitionBacktestReport[]) {
  const marketMap = new Map<
    string,
    {
      market: string;
      betsPlaced: number;
      profit: number;
      stake: number;
      maxDrawdown: number;
    }
  >();

  let totalAnalyzed = 0;
  let totalBets = 0;
  let weightedBrierSum = 0;
  let totalProfit = 0;
  let maxDrawdown = 0;
  let latestGeneratedAt: string | undefined;

  for (const report of reports) {
    totalAnalyzed += report.totalAnalyzed;
    totalBets += report.totalBets;
    weightedBrierSum +=
      (toNumber(report.averageBrierScore) ?? 0) * report.totalAnalyzed;
    maxDrawdown = Math.max(
      maxDrawdown,
      toNumber(report.maxDrawdownSimulated) ?? 0,
    );
    if (!latestGeneratedAt || report.reportGeneratedAt > latestGeneratedAt) {
      latestGeneratedAt = report.reportGeneratedAt;
    }

    for (const market of report.marketPerformance ?? []) {
      const stake = toNumber(market.stake) ?? market.betsPlaced;
      const profit = toNumber(market.profit) ?? 0;
      const existing = marketMap.get(market.market) ?? {
        market: market.market,
        betsPlaced: 0,
        profit: 0,
        stake: 0,
        maxDrawdown: 0,
      };

      existing.betsPlaced += market.betsPlaced;
      existing.profit += profit;
      existing.stake += stake;
      existing.maxDrawdown = Math.max(
        existing.maxDrawdown,
        toNumber(market.maxDrawdown) ?? 0,
      );
      marketMap.set(market.market, existing);
      totalProfit += profit;
    }
  }

  const marketPerformance: BacktestMarketPerformance[] = Array.from(
    marketMap.values(),
  )
    .map((market) => ({
      market: market.market,
      betsPlaced: market.betsPlaced,
      wins: 0,
      losses: 0,
      voids: 0,
      stake: market.stake,
      profit: market.profit,
      roi: market.stake > 0 ? market.profit / market.stake : 0,
      averageOdds: 0,
      averageEv: 0,
      maxDrawdown: market.maxDrawdown,
    }))
    .sort((left, right) => right.betsPlaced - left.betsPlaced);

  return {
    analyzedCount: totalAnalyzed,
    brierScore:
      totalAnalyzed > 0 ? weightedBrierSum / totalAnalyzed : undefined,
    roiSimulated: totalBets > 0 ? totalProfit / totalBets : undefined,
    maxDrawdownSimulated: maxDrawdown,
    marketPerformance,
    reportGeneratedAt: latestGeneratedAt,
  };
}

export function BacktestSection() {
  const t = useTranslations("performancePage");
  const common = useTranslations("common");
  const mutation = useRunBacktest();
  const [storedResponse, setStoredResponse] = useState<BacktestResponse | null>(
    null,
  );

  useEffect(() => {
    setStoredResponse(loadStoredBacktest());
  }, []);

  useEffect(() => {
    if (!mutation.data) return;
    saveStoredBacktest(mutation.data);
    setStoredResponse(mutation.data);
  }, [mutation.data]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) {
        setStoredResponse(loadStoredBacktest());
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const sourceResponse = mutation.data ?? storedResponse;
  const report = Array.isArray(sourceResponse)
    ? aggregateBacktestReports(sourceResponse)
    : sourceResponse;
  const isStoredResult = !mutation.data && storedResponse !== null;
  const generatedAt = report?.reportGeneratedAt;

  const chartData =
    report?.marketPerformance?.map((market) => ({
      market: formatMarketForDisplay(market.market),
      roi: toNumber(market.roi) ?? 0,
    })) ?? [];

  return (
    <TableCard
      title={t("backtest")}
      subtitle={t("backtestHint")}
      action={
        <Button
          type="button"
          size="sm"
          className="gap-2"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <>
              <Loader2 data-icon="inline-start" className="animate-spin" />
              {t("backtestRunning")}
            </>
          ) : (
            <>
              <Play data-icon="inline-start" />
              {t("runBacktest")}
            </>
          )}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 p-4 sm:p-5">
        {report && generatedAt ? (
          <div className="rounded-[1.2rem] border border-border bg-panel px-4 py-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              {isStoredResult
                ? t("backtestStoredTitle")
                : t("backtestFreshTitle")}
            </p>
            <p className="mt-1">
              {t("backtestGeneratedAt", {
                date: formatDateLong(generatedAt),
                time: formatTime(generatedAt),
              })}
            </p>
          </div>
        ) : null}

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

        {report ? (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                label={t("roiSimulated")}
                value={formatBacktestPercent(toNumber(report.roiSimulated))}
                tone="accent"
                compact
              />
              <StatCard
                label={t("stats.brierScore")}
                value={formatDecimal(report.brierScore, 3)}
                tone="warning"
                compact
              />
              <StatCard
                label={t("maxDrawdown")}
                value={formatUnits(report.maxDrawdownSimulated)}
                tone="danger"
                compact
              />
              <StatCard
                label={t("stats.analyzedBets")}
                value={formatInteger(report.analyzedCount)}
                tone="neutral"
                compact
              />
            </div>

            {chartData.length > 0 ? (
              <div className="rounded-[1.2rem] border border-border bg-panel px-4 py-4">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t("marketBreakdown")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("marketBreakdownHint")}
                </p>
                <EvBarChart
                  className="mt-4"
                  data={chartData}
                  xKey="market"
                  height={260}
                  bars={[
                    {
                      key: "roi",
                      color: CHART_COLORS.indigo,
                      label: t("chart.roi"),
                    },
                  ]}
                  formatY={(value) => `${(Number(value) * 100).toFixed(1)}%`}
                />
              </div>
            ) : (
              <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
                <EmptyHeader>
                  <EmptyTitle>{t("backtestEmptyTitle")}</EmptyTitle>
                  <EmptyDescription>{t("backtestEmpty")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </>
        ) : mutation.isPending ? (
          <div className="flex items-center gap-3 rounded-[1.2rem] border border-border bg-panel px-4 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>{t("backtestRunning")}</span>
          </div>
        ) : mutation.error ? null : (
          <p className="text-sm text-muted-foreground">{t("backtestIdle")}</p>
        )}
      </div>
    </TableCard>
  );
}
