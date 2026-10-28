"use client";

import { useMemo, useState } from "react";
import {
  Button,
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  FilterBar,
  Page,
  PageContent,
  PageHeader,
  PageHeaderTitle,
  StatCard,
  TableCard,
} from "@evcore/ui";
import type { FilterDef, FilterState } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import { useBankrollSummary } from "@/domains/bankroll/use-cases/get-bankroll-summary";
import { useBankrollTransactionsForUser } from "@/domains/bankroll/use-cases/get-bankroll-transactions";
import { useOperatorSummary } from "@/domains/bet-slip/use-cases/get-operator-summary";
import { formatDateLong, formatDateShort, todayIso } from "@/lib/date";
import { useCurrencyFormat } from "@/providers/currency-provider";
import { Amount } from "@/components/amount";
import { DepositDialog } from "@/components/deposit-dialog";
import {
  type Translator,
  buildTrendPoints,
  enrichTransactions,
  parseAmount,
  toIsoDay,
  transactionTypeLabel,
} from "./bankroll-constants";
import { buildHistoryColumns } from "./bankroll-history-columns";
import { BankrollTrendChart } from "./bankroll-trend-chart";

function buildBankrollFilters(t: Translator): FilterDef[] {
  return [
    { key: "from", type: "date", label: t("filter.from") },
    { key: "to", type: "date", label: t("filter.to") },
    {
      key: "type",
      type: "select",
      label: t("filter.type"),
      options: [
        { value: "ALL", label: t("filter.allTypes") },
        { value: "DEPOSIT", label: t("filter.deposit") },
        { value: "BET_PLACED", label: t("filter.stake") },
        { value: "BET_WON", label: t("filter.return") },
        { value: "BET_VOID", label: t("filter.refund") },
        { value: "SLIP_CANCELLED", label: t("filter.slipCancelled") },
        { value: "WITHDRAWAL", label: t("filter.withdrawal") },
      ],
    },
  ];
}

/**
 * Suivi de mise : un solde déclaré, pas un portefeuille. Plus de « ROI net »
 * (solde − dépôts) ÷ dépôts, sans période, calculé sur les 200 derniers
 * mouvements ; plus de « ROI sur la période » qui comptait les mises en
 * attente comme perdues (revue UX du 2026-10-27, P1-2 et P1-3). Le résultat
 * des paris vient du même calcul que Mes coupons, daté et compté.
 */
export function BankrollPageClient() {
  const t = useTranslations("bankrollPage");
  const currentUser = useCurrentUser();
  const { formatAmount, formatSigned } = useCurrencyFormat();
  const [filterState, setFilterState] = useState<FilterState>({
    from: "",
    to: todayIso(),
    type: "ALL",
  });

  const bankrollFilters = useMemo(() => buildBankrollFilters(t), [t]);
  const columns = useMemo(
    () => buildHistoryColumns(t, formatAmount, formatSigned),
    [t, formatAmount, formatSigned],
  );
  const summaryQuery = useBankrollSummary(currentUser.id);
  const transactionsQuery = useBankrollTransactionsForUser(currentUser.id);
  const { data: slips } = useOperatorSummary();
  const money = slips?.money;

  const currentBalance = Number.parseFloat(summaryQuery.data?.balance ?? "0");

  const enrichedTransactions = useMemo(
    () => enrichTransactions(transactionsQuery.data ?? [], currentBalance, t),
    [currentBalance, t, transactionsQuery.data],
  );

  const filteredTransactions = useMemo(() => {
    const from = (filterState.from as string) || "";
    const to = (filterState.to as string) || "";
    const type = (filterState.type as string) || "ALL";
    return enrichedTransactions.filter((row) => {
      const day = toIsoDay(row.createdAt);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (type !== "ALL" && row.type !== type) return false;
      return true;
    });
  }, [enrichedTransactions, filterState]);

  const trendPoints = useMemo(
    () => buildTrendPoints(filteredTransactions),
    [filteredTransactions],
  );

  const isLoading = summaryQuery.isLoading || transactionsQuery.isLoading;
  const hasError = summaryQuery.isError || transactionsQuery.isError;
  const retry = () => {
    void summaryQuery.refetch();
    void transactionsQuery.refetch();
  };

  return (
    <Page className="flex h-full flex-col">
      <PageHeader className="flex-col items-start gap-1 lg:flex-col lg:items-start lg:justify-start">
        <PageHeaderTitle>{t("title")}</PageHeaderTitle>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          {t("intro")}
        </p>
      </PageHeader>
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5 pb-20">
          <section data-tour="bankroll-summary" className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <StatCard
                tone="neutral"
                label={t("stats.currentBalance")}
                value={summaryQuery.data ? formatAmount(currentBalance) : "—"}
              />
              {/* Avec des retraits, la carte montre ce qui reste apporté :
                  sinon le solde semble avoir perdu ce qui a été retiré. */}
              <StatCard
                tone="neutral"
                label={
                  summaryQuery.data && Number(summaryQuery.data.withdrawn) > 0
                    ? t("stats.netDeposited")
                    : t("stats.totalDeposited")
                }
                value={
                  summaryQuery.data
                    ? formatAmount(
                        Number(summaryQuery.data.deposited) -
                          Number(summaryQuery.data.withdrawn),
                      )
                    : "—"
                }
              />
              <StatCard
                tone="neutral"
                label={t("stats.betsResult")}
                value={
                  money && money.settledSlips > 0
                    ? formatSigned(money.net)
                    : "—"
                }
              />
            </div>
            <p
              data-testid="bankroll-result"
              className="text-sm leading-6 text-muted-foreground"
            >
              {money?.firstSlipAt && money.settledSlips > 0
                ? t("resultLine", {
                    date: formatDateLong(money.firstSlipAt),
                    settled: money.settledSlips,
                    staked: formatAmount(money.settledStake),
                    returned: formatAmount(money.returned),
                  })
                : t("resultEmpty")}{" "}
              {t("declarative")}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-start">
              <DepositDialog />
              <DepositDialog mode="withdraw" />
            </div>
          </section>

          <FilterBar
            filters={bankrollFilters}
            value={filterState}
            onChange={setFilterState}
            onReset={() =>
              setFilterState({ from: "", to: todayIso(), type: "ALL" })
            }
          />

          <TableCard title={t("trend.title")} subtitle={t("trend.subtitle")}>
            {hasError ? (
              <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
                <EmptyHeader>
                  <EmptyTitle>{t("loadError")}</EmptyTitle>
                </EmptyHeader>
                <Button variant="outline" onClick={retry}>
                  {t("retry")}
                </Button>
              </Empty>
            ) : isLoading ? (
              <p className="p-5 text-sm text-muted-foreground" role="status">
                {t("loading")}
              </p>
            ) : (
              <BankrollTrendChart points={trendPoints} />
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
              pagination={{ pageSize: 25, pageSizeOptions: [10, 25, 50, 100] }}
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
                <div className="flex flex-col gap-2 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {row.detailLabel}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateShort(row.createdAt)} ·{" "}
                        {transactionTypeLabel(row.type, t)}
                      </p>
                    </div>
                    <Amount
                      value={parseAmount(row.amount)}
                      signed
                      className="shrink-0 text-sm font-semibold text-foreground"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("table.balanceAfter")}</span>
                    <Amount
                      value={row.balanceAfter}
                      className="font-semibold text-foreground"
                    />
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
