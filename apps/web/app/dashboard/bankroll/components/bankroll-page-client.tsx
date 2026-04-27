"use client";

import { useMemo, useState } from "react";
import {
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  FilterBar,
  Page,
  PageContent,
  ProgressBar,
  StatCard,
  StatList,
  TableCard,
} from "@evcore/ui";
import type { FilterDef, FilterState } from "@evcore/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownLeft, ArrowUpRight, LineChart, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useBankrollBalance } from "@/domains/bankroll/use-cases/get-bankroll-balance";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBankrollTransactions } from "@/domains/bankroll/use-cases/get-bankroll-transactions";
import type {
  BankrollTransaction,
  BankrollTransactionType,
} from "@/domains/bankroll/types/bankroll";
import { useBetSlips } from "@/domains/bet-slip/use-cases/get-bet-slips";
import { formatDateShort, todayIso } from "@/lib/date";
import { formatMarketForDisplay } from "@/helpers/fixture";
import { formatCurrency, formatSignedCurrency } from "@/helpers/number";
import { CanalBadge } from "@/components/canal-badge";
import { EvAreaChart } from "@/components/charts/ev-area-chart";
import { DepositDialog } from "./deposit-dialog";

type EnrichedTransaction = BankrollTransaction & {
  balanceAfter: number;
  detailLabel: string;
};

type Translator = ReturnType<typeof useTranslations>;

type TrendPoint = {
  day: string;
  label: string;
  balance: number;
};

function transactionTypeLabel(type: BankrollTransactionType, t: Translator) {
  switch (type) {
    case "DEPOSIT":
      return t("filter.deposit");
    case "BET_PLACED":
      return t("filter.stake");
    case "BET_WON":
      return t("filter.win");
    case "BET_VOID":
      return t("filter.refund");
    default:
      return type;
  }
}

function transactionTone(
  type: BankrollTransactionType,
): "positive" | "negative" | "neutral" {
  switch (type) {
    case "DEPOSIT":
    case "BET_WON":
    case "BET_VOID":
      return "positive";
    case "BET_PLACED":
      return "negative";
    default:
      return "neutral";
  }
}

function parseAmount(value: string) {
  return Number.parseFloat(value);
}

function toIsoDay(value: string) {
  return value.slice(0, 10);
}

function buildTrendPoints(rows: EnrichedTransaction[]): TrendPoint[] {
  if (rows.length === 0) return [];
  const byDay = new Map<string, TrendPoint>();
  for (const row of [...rows].reverse()) {
    const day = toIsoDay(row.createdAt);
    byDay.set(day, {
      day,
      label: formatDateShort(day),
      balance: row.balanceAfter,
    });
  }
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function buildTypeOptions(t: Translator) {
  return [
    { value: "ALL", label: t("filter.allTypes") },
    { value: "DEPOSIT", label: t("filter.deposit") },
    { value: "BET_PLACED", label: t("filter.stake") },
    { value: "BET_WON", label: t("filter.win") },
    { value: "BET_VOID", label: t("filter.refund") },
  ] as const;
}

function buildBankrollFilters(t: Translator): FilterDef[] {
  const typeOptions = buildTypeOptions(t);

  return [
    { key: "from", type: "date", label: t("filter.from") },
    { key: "to", type: "date", label: t("filter.to") },
    {
      key: "type",
      type: "select",
      label: t("filter.type"),
      options: typeOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    },
  ];
}

function buildColumns(t: Translator): ColumnDef<EnrichedTransaction>[] {
  return [
    {
      id: "date",
      header: t("table.date"),
      accessorFn: (row) => formatDateShort(row.createdAt),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue<string>()}</span>
      ),
    },
    {
      id: "type",
      header: t("table.type"),
      accessorFn: (row) => transactionTypeLabel(row.type, t),
    },
    {
      id: "amount",
      header: t("table.amount"),
      accessorFn: (row) => parseAmount(row.amount),
      cell: ({ row }) => {
        const tone = transactionTone(row.original.type);
        const cls =
          tone === "positive"
            ? "text-success"
            : tone === "negative"
              ? "text-danger"
              : "";
        return (
          <div className="flex items-center justify-end gap-2">
            {row.original.canal && <CanalBadge canal={row.original.canal} />}
            <span className={`tabular-nums font-semibold ${cls}`}>
              {formatSignedCurrency(parseAmount(row.original.amount))}
            </span>
          </div>
        );
      },
      meta: { align: "right" },
    },
    {
      id: "detail",
      header: t("table.detail"),
      accessorFn: (row) => row.detailLabel,
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue<string>()}</span>
      ),
    },
    {
      id: "balance",
      header: t("table.balanceAfter"),
      accessorFn: (row) => row.balanceAfter,
      cell: ({ getValue }) => (
        <span className="tabular-nums font-semibold">
          {formatCurrency(getValue<number>())}
        </span>
      ),
      meta: { align: "right" },
    },
  ];
}

function BankrollTrendChart({
  points,
  t,
}: {
  points: TrendPoint[];
  t: Translator;
}) {
  if (points.length === 0) {
    return (
      <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
        <EmptyHeader>
          <EmptyTitle>{t("trend.notEnoughData")}</EmptyTitle>
          <EmptyDescription>
            {t("trend.notEnoughDataDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const minY = Math.min(...points.map((p) => p.balance));
  const maxY = Math.max(...points.map((p) => p.balance));

  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("trend.recent")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatCurrency(points[points.length - 1]?.balance ?? 0, true)}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>{points[0]?.label}</p>
          <p className="mt-1">{points[points.length - 1]?.label}</p>
        </div>
      </div>

      <EvAreaChart
        data={points}
        xKey="label"
        yKey="balance"
        color="#2563eb"
        height={140}
        className="mt-4"
        formatY={(v) => formatCurrency(v, true)}
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <StatList
          items={[
            { label: t("trend.lowest"), value: formatCurrency(minY) },
            { label: t("trend.highest"), value: formatCurrency(maxY) },
            { label: t("trend.displayedDays"), value: String(points.length) },
          ]}
        />
      </div>
    </div>
  );
}

export function BankrollPageClient() {
  const tCommon = useTranslations("common");
  const t = useTranslations("bankrollPage");
  const [filterState, setFilterState] = useState<FilterState>({
    from: "",
    to: todayIso(),
    type: "ALL",
  });

  const isMobile = useIsMobile();
  const bankrollFilters = useMemo(() => buildBankrollFilters(t), [t]);
  const columns = useMemo(() => buildColumns(t), [t]);
  const balanceQuery = useBankrollBalance();
  const transactionsQuery = useBankrollTransactions();
  const betSlipsQuery = useBetSlips();

  const currentBalance = Number.parseFloat(balanceQuery.data?.balance ?? "0");

  const betMetadata = useMemo(() => {
    const mapping = new Map<string, { fixture: string; market: string }>();
    for (const betSlip of betSlipsQuery.data ?? []) {
      for (const item of betSlip.items) {
        mapping.set(item.betId, { fixture: item.fixture, market: item.market });
      }
    }
    return mapping;
  }, [betSlipsQuery.data]);

  const enrichedTransactions = useMemo<EnrichedTransaction[]>(() => {
    let runningBalance = currentBalance;
    return (transactionsQuery.data ?? []).map((transaction) => {
      const amount = parseAmount(transaction.amount);
      const metadata = transaction.betId
        ? betMetadata.get(transaction.betId)
        : undefined;
      const detailLabel =
        transaction.type === "DEPOSIT"
          ? transaction.note || t("fallback.deposit")
          : metadata
            ? `${metadata.fixture} (${formatMarketForDisplay(metadata.market)})`
            : transaction.note || t("fallback.bet");
      const row = { ...transaction, balanceAfter: runningBalance, detailLabel };
      runningBalance -= amount;
      return row;
    });
  }, [betMetadata, currentBalance, t, transactionsQuery.data]);

  const filteredTransactions = useMemo(() => {
    const from = (filterState.from as string) || "";
    const to = (filterState.to as string) || "";
    const type = (filterState.type as string) || "ALL";

    return enrichedTransactions.filter((t) => {
      const day = toIsoDay(t.createdAt);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (type !== "ALL" && t.type !== type) return false;
      return true;
    });
  }, [enrichedTransactions, filterState]);

  const totalDeposited = useMemo(
    () =>
      enrichedTransactions
        .filter((t) => t.type === "DEPOSIT")
        .reduce((sum, t) => sum + parseAmount(t.amount), 0),
    [enrichedTransactions],
  );

  const roi =
    totalDeposited > 0
      ? ((currentBalance - totalDeposited) / totalDeposited) * 100
      : null;

  const trendPoints = useMemo(
    () => buildTrendPoints(filteredTransactions),
    [filteredTransactions],
  );

  const isLoading =
    balanceQuery.isLoading ||
    transactionsQuery.isLoading ||
    betSlipsQuery.isLoading;
  const hasError = balanceQuery.error || transactionsQuery.error;

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard
              compact={isMobile}
              icon={<Wallet size={14} />}
              label={t("stats.currentBalance")}
              value={formatCurrency(currentBalance, true)}
              tone="accent"
            />
            <StatCard
              compact={isMobile}
              icon={<ArrowDownLeft size={14} />}
              label={t("stats.totalDeposited")}
              value={formatCurrency(totalDeposited, true)}
              tone="neutral"
            />
            <div className="col-span-2 sm:col-span-1">
              <StatCard
                compact={isMobile}
                icon={<ArrowUpRight size={14} />}
                label={t("stats.netRoi")}
                value={formatPercent(roi)}
                tone={(roi ?? 0) >= 0 ? "success" : "danger"}
              />
            </div>
          </section>

          <div className="flex justify-stretch sm:justify-end">
            <div className="w-full sm:w-auto">
              <DepositDialog />
            </div>
          </div>

          <FilterBar
            filters={bankrollFilters}
            value={filterState}
            onChange={setFilterState}
            onReset={() =>
              setFilterState({ from: "", to: todayIso(), type: "ALL" })
            }
          />

          <TableCard
            title={t("trend.title")}
            subtitle={t("trend.subtitle")}
            action={
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LineChart size={14} />
                {trendPoints.length}{" "}
                {trendPoints.length > 1 ? t("trend.points") : t("trend.point")}
              </div>
            }
          >
            {hasError ? (
              <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
                <EmptyHeader>
                  <EmptyTitle>{tCommon("error")}</EmptyTitle>
                  <EmptyDescription>
                    {hasError instanceof Error
                      ? hasError.message
                      : t("trend.portfolioLoadError")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : isLoading ? (
              <div className="flex h-44 items-center justify-center">
                <ProgressBar
                  value={0}
                  max={100}
                  tone="accent"
                  showValue={false}
                  className="w-24"
                />
              </div>
            ) : (
              <BankrollTrendChart points={trendPoints} t={t} />
            )}
          </TableCard>

          <TableCard
            title={t("history.title")}
            subtitle={t("history.subtitle")}
          >
            <DataTable
              columns={columns}
              data={filteredTransactions}
              isLoading={isLoading}
              emptyState={
                <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
                  <EmptyHeader>
                    <EmptyTitle>{t("history.emptyTitle")}</EmptyTitle>
                    <EmptyDescription>
                      {t("history.emptyDescription")}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              }
              mobileCard={(row) => (
                <div className="flex flex-col gap-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {row.detailLabel}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateShort(row.createdAt)} ·{" "}
                        {transactionTypeLabel(row.type, t)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.canal && <CanalBadge canal={row.canal} />}
                      <p
                        className={`text-sm font-semibold tabular-nums ${transactionTone(row.type) === "positive" ? "text-success" : "text-danger"}`}
                      >
                        {formatSignedCurrency(parseAmount(row.amount))}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("table.balanceAfter")}</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(row.balanceAfter)}
                    </span>
                  </div>
                </div>
              )}
            />
          </TableCard>
        </div>
      </PageContent>
    </Page>
  );
}
