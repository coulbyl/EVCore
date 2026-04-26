"use client";

import { useMemo, useState, type ReactNode } from "react";
import { EvButton, EvEmptyState, Page, PageContent } from "@evcore/ui";
import {
  ArrowDownLeft,
  ArrowUpRight,
  LineChart,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
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
import { TableCard } from "@/components/table-card";
import { DepositDialog } from "./deposit-dialog";

const TYPE_OPTIONS: Array<{
  value: "ALL" | BankrollTransactionType;
  label: string;
}> = [
  { value: "ALL", label: "Tous les types" },
  { value: "DEPOSIT", label: "Dépôt" },
  { value: "BET_PLACED", label: "Mise" },
  { value: "BET_WON", label: "Gain" },
  { value: "BET_VOID", label: "Remboursement" },
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

function KpiCard({
  icon,
  label,
  value,
  tone = "text-slate-950",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-slate-50 px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[0.68rem] sm:tracking-[0.18em]">
        {icon}
        {label}
      </div>
      <p
        className={`mt-2 text-[1.05rem] font-semibold sm:mt-3 sm:text-3xl ${tone}`}
      >
        {value}
      </p>
    </div>
  );
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function transactionTypeLabel(type: BankrollTransactionType) {
  switch (type) {
    case "DEPOSIT":
      return "Dépôt";
    case "BET_PLACED":
      return "Mise";
    case "BET_WON":
      return "Gain";
    case "BET_VOID":
      return "Remboursement";
    default:
      return type;
  }
}

function transactionTone(type: BankrollTransactionType) {
  switch (type) {
    case "DEPOSIT":
    case "BET_WON":
    case "BET_VOID":
      return "text-emerald-600";
    case "BET_PLACED":
      return "text-rose-600";
    default:
      return "text-slate-700";
  }
}

function parseAmount(value: string) {
  return Number.parseFloat(value);
}

function toIsoDay(value: string) {
  return value.slice(0, 10);
}

function buildTrendPoints(rows: EnrichedTransaction[]): TrendPoint[] {
  if (rows.length === 0) {
    return [];
  }

  const byDay = new Map<string, TrendPoint>();

  for (const row of [...rows].reverse()) {
    const day = toIsoDay(row.createdAt);
    byDay.set(day, {
      day,
      label: formatDateShort(day),
      balance: row.balanceAfter,
    });
  }

  return Array.from(byDay.values()).sort((left, right) =>
    left.day.localeCompare(right.day),
  );
}

function BankrollTrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-65 items-center justify-center bg-white">
        <p className="text-sm text-slate-400">
          Pas assez de données pour afficher la courbe.
        </p>
      </div>
    );
  }

  const width = 100;
  const height = 100;
  const minY = Math.min(...points.map((point) => point.balance));
  const maxY = Math.max(...points.map((point) => point.balance));
  const range = maxY - minY || 1;

  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * width;
    const y = height - ((point.balance - minY) / range) * height;
    return { x, y, point };
  });

  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const area = `0,100 ${line} 100,100`;

  return (
    <div className="bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Évolution récente
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {formatUnitsValue(points[points.length - 1]?.balance ?? 0)} u
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>{points[0]?.label}</p>
          <p className="mt-1">{points[points.length - 1]?.label}</p>
        </div>
      </div>

      <div className="mt-5">
        <svg
          viewBox="0 0 100 100"
          className="h-45 w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="bankroll-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(37 99 235 / 0.26)" />
              <stop offset="100%" stopColor="rgb(37 99 235 / 0.03)" />
            </linearGradient>
          </defs>

          <line x1="0" y1="100" x2="100" y2="100" stroke="#e2e8f0" />
          <line x1="0" y1="0" x2="0" y2="100" stroke="#e2e8f0" />
          <polygon points={area} fill="url(#bankroll-area)" />
          <polyline
            points={line}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {coordinates.map(({ x, y, point }) => (
            <g key={`${point.day}-${point.balance}`}>
              <circle
                cx={x}
                cy={y}
                r="2"
                fill="#2563eb"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 grid gap-3 text-xs text-slate-500 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-slate-50 px-3 py-2">
          <p className="uppercase tracking-[0.14em] text-slate-400">Plus bas</p>
          <p className="mt-1 font-semibold text-slate-800">
            {formatUnitsValue(minY)} u
          </p>
        </div>
        <div className="rounded-lg border border-border bg-slate-50 px-3 py-2">
          <p className="uppercase tracking-[0.14em] text-slate-400">
            Plus haut
          </p>
          <p className="mt-1 font-semibold text-slate-800">
            {formatUnitsValue(maxY)} u
          </p>
        </div>
        <div className="rounded-lg border border-border bg-slate-50 px-3 py-2">
          <p className="uppercase tracking-[0.14em] text-slate-400">
            Jours affichés
          </p>
          <p className="mt-1 font-semibold text-slate-800">{points.length}</p>
        </div>
      </div>
    </div>
  );
}

export function BankrollPageClient() {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayIso);
  const [typeFilter, setTypeFilter] = useState<"ALL" | BankrollTransactionType>(
    "ALL",
  );
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState(todayIso);
  const [draftTypeFilter, setDraftTypeFilter] = useState<
    "ALL" | BankrollTransactionType
  >("ALL");

  const balanceQuery = useBankrollBalance();
  const transactionsQuery = useBankrollTransactions();
  const betSlipsQuery = useBetSlips();

  const currentBalance = Number.parseFloat(balanceQuery.data?.balance ?? "0");

  const betMetadata = useMemo(() => {
    const mapping = new Map<string, { fixture: string; market: string }>();

    for (const betSlip of betSlipsQuery.data ?? []) {
      for (const item of betSlip.items) {
        mapping.set(item.betId, {
          fixture: item.fixture,
          market: item.market,
        });
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
          ? transaction.note || "Dépôt"
          : metadata
            ? `${metadata.fixture} (${formatMarketForDisplay(metadata.market)})`
            : transaction.note || "Pari";

      const row = {
        ...transaction,
        balanceAfter: runningBalance,
        detailLabel,
      };

      runningBalance -= amount;
      return row;
    });
  }, [betMetadata, currentBalance, transactionsQuery.data]);

  const filteredTransactions = useMemo(() => {
    return enrichedTransactions.filter((transaction) => {
      const day = toIsoDay(transaction.createdAt);

      if (from && day < from) {
        return false;
      }

      if (to && day > to) {
        return false;
      }

      if (typeFilter !== "ALL" && transaction.type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [enrichedTransactions, from, to, typeFilter]);

  const totalDeposited = useMemo(() => {
    return enrichedTransactions
      .filter((transaction) => transaction.type === "DEPOSIT")
      .reduce((sum, transaction) => sum + parseAmount(transaction.amount), 0);
  }, [enrichedTransactions]);

  const roi =
    totalDeposited > 0
      ? ((currentBalance - totalDeposited) / totalDeposited) * 100
      : null;

  const trendPoints = useMemo(
    () => buildTrendPoints(filteredTransactions),
    [filteredTransactions],
  );

  const activeFilterCount =
    (from ? 1 : 0) +
    (to !== todayIso() ? 1 : 0) +
    (typeFilter !== "ALL" ? 1 : 0);

  const isLoading =
    balanceQuery.isLoading ||
    transactionsQuery.isLoading ||
    betSlipsQuery.isLoading;
  const hasError = balanceQuery.error || transactionsQuery.error;

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="space-y-5">
          <section className="rounded-[1.6rem] border border-border bg-white p-4 sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
                <KpiCard
                  icon={<Wallet size={14} className="text-accent" />}
                  label="Solde actuel"
                  value={`${formatUnitsValue(currentBalance)} u`}
                />
                <KpiCard
                  icon={
                    <ArrowDownLeft size={14} className="text-emerald-600" />
                  }
                  label="Total déposé"
                  value={`${formatUnitsValue(totalDeposited)} u`}
                />
                <KpiCard
                  icon={<ArrowUpRight size={14} className="text-slate-700" />}
                  label="ROI net"
                  value={formatPercent(roi)}
                  tone={(roi ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}
                />
              </div>

              <div className="flex justify-stretch sm:justify-end">
                <div className="w-full sm:w-auto">
                  <DepositDialog />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-border bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <EvButton
                tone={isFiltersOpen ? "primary" : "secondary"}
                className="gap-2"
                onClick={() => setIsFiltersOpen((value) => !value)}
              >
                <SlidersHorizontal size={14} />
                {isFiltersOpen ? "Fermer" : "Filtrer"}
              </EvButton>

              {from ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  Du {formatDateShort(from)}
                </span>
              ) : null}

              {to !== todayIso() ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  Au {formatDateShort(to)}
                </span>
              ) : null}

              {typeFilter !== "ALL" ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {
                    TYPE_OPTIONS.find((option) => option.value === typeFilter)
                      ?.label
                  }
                </span>
              ) : null}

              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                  {activeFilterCount} actif{activeFilterCount > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>

            {isFiltersOpen ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_0.9fr_auto] xl:items-center">
                <input
                  type="date"
                  value={draftFrom}
                  max={draftTo || undefined}
                  onChange={(event) => setDraftFrom(event.target.value)}
                  className="h-10 rounded-xl border border-border bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/40"
                />

                <input
                  type="date"
                  value={draftTo}
                  min={draftFrom || undefined}
                  onChange={(event) => setDraftTo(event.target.value)}
                  className="h-10 rounded-xl border border-border bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/40"
                />

                <select
                  id="bankroll-type-filter"
                  value={draftTypeFilter}
                  onChange={(event) =>
                    setDraftTypeFilter(
                      event.target.value as "ALL" | BankrollTransactionType,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/40"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2 xl:justify-end">
                  <EvButton
                    tone="secondary"
                    onClick={() => {
                      const resetTo = todayIso();
                      setDraftFrom("");
                      setDraftTo(resetTo);
                      setDraftTypeFilter("ALL");
                      setFrom("");
                      setTo(resetTo);
                      setTypeFilter("ALL");
                    }}
                  >
                    Réinitialiser
                  </EvButton>
                  <EvButton
                    onClick={() => {
                      setFrom(draftFrom);
                      setTo(draftTo);
                      setTypeFilter(draftTypeFilter);
                      setIsFiltersOpen(false);
                    }}
                  >
                    Appliquer
                  </EvButton>
                </div>
              </div>
            ) : null}
          </section>

          <div className="grid gap-5">
            <TableCard
              title="Évolution du solde"
              subtitle="Le solde jour après jour, calculé à partir des mouvements récents."
              action={
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <LineChart size={14} />
                  {trendPoints.length} point{trendPoints.length > 1 ? "s" : ""}
                </div>
              }
            >
              {hasError ? (
                <div className="flex h-65 items-center justify-center bg-white px-6 text-center text-sm text-rose-600">
                  {hasError instanceof Error
                    ? hasError.message
                    : "Impossible de charger les données du portefeuille."}
                </div>
              ) : isLoading ? (
                <div className="flex h-65 items-center justify-center bg-white text-sm text-slate-400">
                  Chargement...
                </div>
              ) : (
                <BankrollTrendChart points={trendPoints} />
              )}
            </TableCard>
          </div>

          <TableCard
            title="Historique des mouvements"
            subtitle="Les 200 derniers mouvements, avec le solde après chaque opération."
          >
            {hasError ? (
              <div className="bg-white px-6 py-10 text-sm text-rose-600">
                {hasError instanceof Error
                  ? hasError.message
                  : "Impossible de charger l’historique."}
              </div>
            ) : isLoading ? (
              <div className="bg-white px-6 py-10 text-sm text-slate-400">
                Chargement...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="bg-white p-3">
                <EvEmptyState
                  title="Aucune transaction"
                  description="Aucune transaction ne correspond aux filtres courants."
                />
              </div>
            ) : (
              <>
                <div className="hidden bg-white md:block">
                  <table className="w-full table-fixed">
                    <thead className="border-b border-border bg-slate-50">
                      <tr className="text-left text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Montant</th>
                        <th className="px-4 py-3">Match / note</th>
                        <th className="px-4 py-3 text-right">Solde après</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((transaction) => (
                        <tr
                          key={transaction.id}
                          className="border-b border-border/80 bg-white align-top last:border-b-0"
                        >
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {formatDateShort(transaction.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                            {transactionTypeLabel(transaction.type)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right text-sm font-semibold tabular-nums ${transactionTone(
                              transaction.type,
                            )}`}
                          >
                            {formatSignedUnitsValue(
                              parseAmount(transaction.amount),
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {transaction.detailLabel}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                            {formatUnitsValue(transaction.balanceAfter)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-border bg-white md:hidden">
                  {filteredTransactions.map((transaction) => (
                    <div key={transaction.id} className="space-y-3 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {transaction.detailLabel}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDateShort(transaction.createdAt)} •{" "}
                            {transactionTypeLabel(transaction.type)}
                          </p>
                        </div>
                        <p
                          className={`text-sm font-semibold tabular-nums ${transactionTone(
                            transaction.type,
                          )}`}
                        >
                          {formatSignedUnitsValue(
                            parseAmount(transaction.amount),
                          )}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Solde après</span>
                        <span className="font-semibold tabular-nums text-slate-800">
                          {formatUnitsValue(transaction.balanceAfter)} u
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TableCard>
        </div>
      </PageContent>
    </Page>
  );
}
