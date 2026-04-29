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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type ColumnDef,
  DataTable,
} from "@evcore/ui";
import { Loader2, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { EvBarChart } from "@/components/charts";
import { CHART_COLORS } from "@/components/charts/chart-theme";
import type {
  BacktestResponse,
  BacktestMarketPerformance,
  CompetitionBacktestReport,
  SafeValueBacktestReport,
  BacktestSeasonSummary,
} from "@/domains/backtest/types/backtest";
import { formatMarketForDisplay } from "@/helpers/fixture";
import { useRunBacktest } from "@/domains/backtest/use-cases/run-backtest";
import { useRunSafeValueBacktest } from "@/domains/backtest/use-cases/run-safe-value-backtest";
import { formatDateLong, formatTime } from "@/lib/date";
import {
  formatDecimal,
  formatInteger,
  formatUnits,
  toNumber,
} from "./formatters";

const STORAGE_KEY_EV = "evcore:performance-backtest-result";
const STORAGE_KEY_SV = "evcore:performance-backtest-sv-result";

function formatBacktestPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const scaled = value * 100;
  return `${scaled > 0 ? "+" : ""}${scaled.toFixed(digits)}%`;
}

function loadStored<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable
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

type NormalizedReport = {
  analyzedCount: number;
  brierScore: number | undefined;
  roiSimulated: number | undefined;
  maxDrawdownSimulated: number;
  marketPerformance: BacktestMarketPerformance[];
  reportGeneratedAt: string | undefined;
  seasons?: BacktestSeasonSummary[];
};

function normalizeEvReport(
  sourceResponse: BacktestResponse | null,
): NormalizedReport | null {
  if (!sourceResponse) return null;
  if (Array.isArray(sourceResponse)) {
    const agg = aggregateBacktestReports(sourceResponse);
    const seasons = sourceResponse.flatMap((r) => r.seasons ?? []);
    return { ...agg, seasons: seasons.length > 0 ? seasons : undefined };
  }
  return {
    analyzedCount: sourceResponse.analyzedCount,
    brierScore: toNumber(sourceResponse.brierScore) ?? undefined,
    roiSimulated: toNumber(sourceResponse.roiSimulated) ?? undefined,
    maxDrawdownSimulated: toNumber(sourceResponse.maxDrawdownSimulated) ?? 0,
    marketPerformance: sourceResponse.marketPerformance,
    reportGeneratedAt: sourceResponse.reportGeneratedAt,
  };
}

function EvTabContent({
  t,
  common,
}: {
  t: ReturnType<typeof useTranslations>;
  common: ReturnType<typeof useTranslations>;
}) {
  const mutation = useRunBacktest();
  const [storedResponse, setStoredResponse] = useState<BacktestResponse | null>(
    null,
  );

  useEffect(() => {
    setStoredResponse(loadStored<BacktestResponse>(STORAGE_KEY_EV));
  }, []);

  useEffect(() => {
    if (!mutation.data) return;
    saveStored(STORAGE_KEY_EV, mutation.data);
    setStoredResponse(mutation.data);
  }, [mutation.data]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY_EV) {
        setStoredResponse(loadStored<BacktestResponse>(STORAGE_KEY_EV));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const sourceResponse = mutation.data ?? storedResponse;
  const report = normalizeEvReport(sourceResponse);
  const isStoredResult = !mutation.data && storedResponse !== null;
  const generatedAt = report?.reportGeneratedAt;

  const chartData =
    report?.marketPerformance?.map((market) => ({
      market: formatMarketForDisplay(market.market),
      roi: toNumber(market.roi) ?? 0,
    })) ?? [];

  const seasonColumns: ColumnDef<BacktestSeasonSummary>[] = [
    {
      id: "seasonId",
      header: t("season"),
      accessorKey: "seasonId",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.seasonId.slice(0, 8)}
        </span>
      ),
    },
    {
      id: "analyzed",
      header: t("stats.analyzedBets"),
      accessorFn: (row) => row.analyzedCount,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.analyzedCount}</span>
      ),
    },
    {
      id: "roi",
      header: t("roiSimulated"),
      accessorFn: (row) => toNumber(row.roiSimulated) ?? 0,
      meta: { align: "right" },
      cell: ({ row }) => {
        const val = toNumber(row.original.roiSimulated) ?? 0;
        return (
          <span
            className={`tabular-nums font-semibold ${val >= 0 ? "text-success" : "text-danger"}`}
          >
            {formatBacktestPercent(val)}
          </span>
        );
      },
    },
    {
      id: "brier",
      header: t("stats.brierScore"),
      accessorFn: (row) => toNumber(row.brierScore) ?? 0,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatDecimal(row.original.brierScore, 3)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
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
      </div>

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
          ) : null}

          {report.seasons && report.seasons.length > 0 ? (
            <div className="rounded-[1.2rem] border border-border bg-panel overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t("seasonBreakdown")}
                </p>
              </div>
              <DataTable
                columns={seasonColumns}
                data={report.seasons}
                className="border-0"
                initialSorting={[{ id: "roi", desc: true }]}
              />
            </div>
          ) : null}
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
  );
}

function SvTabContent({
  t,
  common,
}: {
  t: ReturnType<typeof useTranslations>;
  common: ReturnType<typeof useTranslations>;
}) {
  const mutation = useRunSafeValueBacktest();
  const [stored, setStored] = useState<SafeValueBacktestReport | null>(null);

  useEffect(() => {
    setStored(loadStored<SafeValueBacktestReport>(STORAGE_KEY_SV));
  }, []);

  useEffect(() => {
    if (!mutation.data) return;
    saveStored(STORAGE_KEY_SV, mutation.data);
    setStored(mutation.data);
  }, [mutation.data]);

  const report = mutation.data ?? stored;
  const isStoredResult = !mutation.data && stored !== null;
  const generatedAt = report?.generatedAt;

  const chartData =
    report?.aggregate.marketPerformance?.map((market) => ({
      market: formatMarketForDisplay(market.market),
      roi: toNumber(market.roi) ?? 0,
    })) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
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
      </div>

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
              value={formatBacktestPercent(report.aggregate.roi)}
              tone="accent"
              compact
            />
            <StatCard
              label={t("stats.winRate")}
              value={`${(report.aggregate.winRate * 100).toFixed(1)}%`}
              tone="success"
              compact
            />
            <StatCard
              label={t("stats.settledBets")}
              value={String(report.aggregate.picksPlaced)}
              tone="neutral"
              compact
            />
            <StatCard
              label={t("svAvgOdds")}
              value={report.aggregate.avgOdds.toFixed(2)}
              tone="neutral"
              compact
            />
          </div>

          {chartData.length > 0 ? (
            <div className="rounded-[1.2rem] border border-border bg-panel px-4 py-4">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("marketBreakdown")}
              </p>
              <EvBarChart
                className="mt-4"
                data={chartData}
                xKey="market"
                height={260}
                bars={[
                  {
                    key: "roi",
                    color: CHART_COLORS.teal,
                    label: t("chart.roi"),
                  },
                ]}
                formatY={(value) => `${(Number(value) * 100).toFixed(1)}%`}
              />
            </div>
          ) : null}
        </>
      ) : mutation.isPending ? (
        <div className="flex items-center gap-3 rounded-[1.2rem] border border-border bg-panel px-4 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>{t("backtestRunning")}</span>
        </div>
      ) : mutation.error ? null : (
        <p className="text-sm text-muted-foreground">{t("backtestSvIdle")}</p>
      )}
    </div>
  );
}

export function BacktestSection() {
  const t = useTranslations("performancePage");
  const common = useTranslations("common");

  return (
    <TableCard title={t("backtest")} subtitle={t("backtestHint")}>
      <div className="p-4 sm:p-5">
        <Tabs defaultValue="ev">
          <TabsList className="mb-5">
            <TabsTrigger value="ev">{t("backtestTabEv")}</TabsTrigger>
            <TabsTrigger value="sv">{t("backtestTabSv")}</TabsTrigger>
          </TabsList>
          <TabsContent value="ev">
            <EvTabContent t={t} common={common} />
          </TabsContent>
          <TabsContent value="sv">
            <SvTabContent t={t} common={common} />
          </TabsContent>
        </Tabs>
      </div>
    </TableCard>
  );
}
