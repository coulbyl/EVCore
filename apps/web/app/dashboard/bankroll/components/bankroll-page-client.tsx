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
import { useBankrollBalance } from "@/domains/bankroll/use-cases/get-bankroll-balance";
import { useBankrollTransactions } from "@/domains/bankroll/use-cases/get-bankroll-transactions";
import type {
  BankrollTransaction,
  BankrollTransactionType,
} from "@/domains/bankroll/types/bankroll";
import { useBetSlips } from "@/domains/bet-slip/use-cases/get-bet-slips";
import { formatDateShort, todayIso } from "@/lib/date";
import { formatMarketForDisplay } from "@/helpers/fixture";
import { formatSignedUnitsValue, formatUnitsValue } from "@/helpers/number";
import { EvAreaChart } from "@/components/charts/ev-area-chart";
import { DepositDialog } from "./deposit-dialog";

const TYPE_OPTIONS = [
  { value: "ALL", label: "Tous les types" },
  { value: "DEPOSIT", label: "Dépôt" },
  { value: "BET_PLACED", label: "Mise" },
  { value: "BET_WON", label: "Gain" },
  { value: "BET_VOID", label: "Remboursement" },
] as const;

const BANKROLL_FILTERS: FilterDef[] = [
  { key: "from", type: "date", label: "Du" },
  { key: "to", type: "date", label: "Au" },
  {
    key: "type",
    type: "select",
    label: "Type",
    options: TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  },
];

type EnrichedTransaction = BankrollTransaction & {
  balanceAfter: number;
  detailLabel: string;
};

type TrendPoint = {
  day: string;
  label: string;
  balance: number;
};

function transactionTypeLabel(type: BankrollTransactionType) {
  switch (type) {
    case "DEPOSIT": return "Dépôt";
    case "BET_PLACED": return "Mise";
    case "BET_WON": return "Gain";
    case "BET_VOID": return "Remboursement";
    default: return type;
  }
}

function transactionTone(type: BankrollTransactionType): "positive" | "negative" | "neutral" {
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
    byDay.set(day, { day, label: formatDateShort(day), balance: row.balanceAfter });
  }
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

const COLUMNS: ColumnDef<EnrichedTransaction>[] = [
  {
    id: "date",
    header: "Date",
    accessorFn: (row) => formatDateShort(row.createdAt),
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span>,
  },
  {
    id: "type",
    header: "Type",
    accessorFn: (row) => transactionTypeLabel(row.type),
  },
  {
    id: "amount",
    header: "Montant",
    accessorFn: (row) => parseAmount(row.amount),
    cell: ({ row }) => {
      const tone = transactionTone(row.original.type);
      const cls = tone === "positive" ? "text-success" : tone === "negative" ? "text-danger" : "";
      return (
        <span className={`tabular-nums font-semibold ${cls}`}>
          {formatSignedUnitsValue(parseAmount(row.original.amount))}
        </span>
      );
    },
    meta: { align: "right" },
  },
  {
    id: "detail",
    header: "Match / note",
    accessorFn: (row) => row.detailLabel,
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span>,
  },
  {
    id: "balance",
    header: "Solde après",
    accessorFn: (row) => row.balanceAfter,
    cell: ({ getValue }) => (
      <span className="tabular-nums font-semibold">{formatUnitsValue(getValue<number>())}</span>
    ),
    meta: { align: "right" },
  },
];

function BankrollTrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) {
    return (
      <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
        <EmptyHeader>
          <EmptyTitle>Pas assez de données</EmptyTitle>
          <EmptyDescription>
            Effectuez des transactions pour voir la courbe d&apos;évolution.
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
            Évolution récente
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatUnitsValue(points[points.length - 1]?.balance ?? 0)} u
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
        formatY={(v) => `${formatUnitsValue(v)}u`}
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <StatList
          items={[
            { label: "Plus bas", value: `${formatUnitsValue(minY)} u` },
            { label: "Plus haut", value: `${formatUnitsValue(maxY)} u` },
            { label: "Jours affichés", value: String(points.length) },
          ]}
        />
      </div>
    </div>
  );
}

export function BankrollPageClient() {
  const [filterState, setFilterState] = useState<FilterState>({
    from: "",
    to: todayIso(),
    type: "ALL",
  });

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
      const metadata = transaction.betId ? betMetadata.get(transaction.betId) : undefined;
      const detailLabel =
        transaction.type === "DEPOSIT"
          ? (transaction.note || "Dépôt")
          : metadata
            ? `${metadata.fixture} (${formatMarketForDisplay(metadata.market)})`
            : (transaction.note || "Pari");
      const row = { ...transaction, balanceAfter: runningBalance, detailLabel };
      runningBalance -= amount;
      return row;
    });
  }, [betMetadata, currentBalance, transactionsQuery.data]);

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

  const roi = totalDeposited > 0 ? ((currentBalance - totalDeposited) / totalDeposited) * 100 : null;

  const trendPoints = useMemo(() => buildTrendPoints(filteredTransactions), [filteredTransactions]);

  const isLoading = balanceQuery.isLoading || transactionsQuery.isLoading || betSlipsQuery.isLoading;
  const hasError = balanceQuery.error || transactionsQuery.error;

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard
              icon={<Wallet size={14} />}
              label="Solde actuel"
              value={`${formatUnitsValue(currentBalance)} u`}
              tone="accent"
            />
            <StatCard
              icon={<ArrowDownLeft size={14} />}
              label="Total déposé"
              value={`${formatUnitsValue(totalDeposited)} u`}
              tone="neutral"
            />
            <StatCard
              icon={<ArrowUpRight size={14} />}
              label="ROI net"
              value={formatPercent(roi)}
              tone={(roi ?? 0) >= 0 ? "success" : "danger"}
            />
          </section>

          <div className="flex justify-stretch sm:justify-end">
            <div className="w-full sm:w-auto">
              <DepositDialog />
            </div>
          </div>

          <FilterBar
            filters={BANKROLL_FILTERS}
            value={filterState}
            onChange={setFilterState}
            onReset={() => setFilterState({ from: "", to: todayIso(), type: "ALL" })}
          />

          <TableCard
            title="Évolution du solde"
            subtitle="Le solde jour après jour, calculé à partir des mouvements récents."
            action={
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LineChart size={14} />
                {trendPoints.length} point{trendPoints.length > 1 ? "s" : ""}
              </div>
            }
          >
            {hasError ? (
              <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
                <EmptyHeader>
                  <EmptyTitle>Erreur</EmptyTitle>
                  <EmptyDescription>
                    {hasError instanceof Error
                      ? hasError.message
                      : "Impossible de charger les données du portefeuille."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : isLoading ? (
              <div className="flex h-44 items-center justify-center">
                <ProgressBar value={0} max={100} tone="accent" showValue={false} className="w-24" />
              </div>
            ) : (
              <BankrollTrendChart points={trendPoints} />
            )}
          </TableCard>

          <TableCard
            title="Historique des mouvements"
            subtitle="Les 200 derniers mouvements, avec le solde après chaque opération."
          >
            <DataTable
              columns={COLUMNS}
              data={filteredTransactions}
              isLoading={isLoading}
              emptyState={
                <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
                  <EmptyHeader>
                    <EmptyTitle>Aucune transaction</EmptyTitle>
                    <EmptyDescription>
                      Aucune transaction ne correspond aux filtres courants.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              }
              mobileCard={(row) => (
                <div className="space-y-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{row.detailLabel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateShort(row.createdAt)} · {transactionTypeLabel(row.type)}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums ${transactionTone(row.type) === "positive" ? "text-success" : "text-danger"}`}>
                      {formatSignedUnitsValue(parseAmount(row.amount))}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Solde après</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatUnitsValue(row.balanceAfter)} u
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
