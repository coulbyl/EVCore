"use client";

import { useMemo, useState } from "react";
import { Drawer } from "vaul";
import {
  Badge,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  FilterBar,
  Page,
  PageContent,
  StatCard,
} from "@evcore/ui";
import type { FilterDef, FilterState } from "@evcore/ui";
import { formatDateLong, todayIso, daysAgoIso } from "@/lib/date";
import { useBetSlips } from "@/domains/bet-slip/use-cases/get-bet-slips";
import { useIsMobile } from "@/hooks/use-mobile";
import type { BetSlipView } from "@/domains/bet-slip/types/bet-slip";
import { BetSlipDetailPanel } from "./bet-slip-detail-panel";

type SlipTypeFilter = "ALL" | BetSlipView["type"];
type BadgeTone = "accent" | "success" | "warning" | "danger" | "neutral";
type CouponSummary = {
  totalStake: number;
  returned: number;
  netPnl: number;
  totalOdds: number | null;
  potentialReturn: number;
  settledCount: number;
  pendingCount: number;
  pendingSelections: number;
  status: "Gagné" | "Perdu" | "En attente";
  statusTone: BadgeTone;
};

const SLIP_FILTERS: FilterDef[] = [
  {
    key: "type",
    type: "select",
    label: "Type",
    options: [
      { value: "ALL", label: "Tous" },
      { value: "SIMPLE", label: "Simples" },
      { value: "COMBO", label: "Combinés" },
    ],
  },
  { key: "from", type: "date", label: "Du" },
  { key: "to", type: "date", label: "Au" },
];

function formatAmount(value: string | number) {
  return Number(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function totalOdds(betSlip: BetSlipView) {
  return betSlip.items.reduce((product, item) => {
    const odds = Number(item.odds ?? 1);
    return Number.isFinite(odds) && odds > 0 ? product * odds : product;
  }, 1);
}

function couponSummary(betSlip: BetSlipView): CouponSummary {
  if (betSlip.type === "COMBO") {
    const hasPending = betSlip.items.some((i) => i.betStatus === "PENDING");
    const allWon = betSlip.items.every((i) => i.betStatus === "WON");
    const stake = Number(betSlip.unitStake);
    const odds = totalOdds(betSlip);
    const returned = !hasPending && allWon ? stake * odds : 0;
    const netPnl = !hasPending ? returned - stake : 0;
    return {
      totalStake: stake,
      returned,
      netPnl,
      totalOdds: odds,
      potentialReturn: stake * odds,
      settledCount: hasPending ? 0 : 1,
      pendingCount: hasPending ? 1 : 0,
      pendingSelections: hasPending ? betSlip.items.length : 0,
      status: hasPending ? "En attente" : allWon ? "Gagné" : "Perdu",
      statusTone: hasPending ? "warning" : allWon ? "success" : "danger",
    };
  }

  let returned = 0,
    settledCount = 0,
    pendingCount = 0,
    totalStake = 0,
    settledStake = 0,
    potentialReturn = 0;
  for (const item of betSlip.items) {
    const stake = Number(item.stake);
    const odds = Number(item.odds ?? 0);
    totalStake += stake;
    if (Number.isFinite(odds)) potentialReturn += stake * odds;
    if (item.betStatus === "WON" || item.betStatus === "LOST") {
      settledCount++;
      settledStake += stake;
      if (item.betStatus === "WON" && item.odds !== null)
        returned += stake * Number(item.odds);
    } else {
      pendingCount++;
    }
  }
  const netPnl = returned - settledStake;
  const isWon = returned >= totalStake;
  return {
    totalStake,
    returned,
    netPnl,
    totalOdds: null,
    potentialReturn,
    settledCount,
    pendingCount,
    pendingSelections: pendingCount,
    status: pendingCount > 0 ? "En attente" : isWon ? "Gagné" : "Perdu",
    statusTone: pendingCount > 0 ? "warning" : isWon ? "success" : "danger",
  };
}

function BetSlipCard({
  betSlip,
  selected,
  onClick,
}: {
  betSlip: BetSlipView;
  selected: boolean;
  onClick: () => void;
}) {
  const summary = couponSummary(betSlip);
  const { settledCount, pendingCount, status } = summary;
  const isPartial = settledCount > 0 && pendingCount > 0;
  const isFullySettled = settledCount > 0 && pendingCount === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-colors ${
        selected
          ? "border-accent bg-accent/5"
          : "border-border bg-panel hover:bg-secondary"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Coupon
          </p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            #{betSlip.id.slice(0, 8)}
          </h2>
        </div>
        <Badge variant="accent">
          {betSlip.type === "COMBO" ? "Combiné" : "Simples"} ·{" "}
          {betSlip.itemCount} sélection{betSlip.itemCount > 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="mt-3 flex flex-col gap-1.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Créé le</span>
          <span className="font-medium text-foreground">
            {formatDateLong(betSlip.createdAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Total misé</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatAmount(summary.totalStake)}
          </span>
        </div>
        {betSlip.type === "COMBO" && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Cote totale</span>
            <span className="font-semibold tabular-nums text-foreground">
              {summary.totalOdds?.toFixed(2)}
            </span>
          </div>
        )}
        {(isFullySettled || isPartial) && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              {isPartial ? "Résultat partiel" : "Résultat"}
            </span>
            <span
              className={`font-bold tabular-nums ${summary.netPnl >= 0 ? "text-success" : "text-danger"}`}
            >
              {summary.netPnl >= 0 ? "+" : ""}
              {formatAmount(summary.netPnl)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Statut</span>
          <Badge
            variant={
              summary.statusTone === "danger"
                ? "destructive"
                : summary.statusTone
            }
            className="py-0.5 text-[0.62rem]"
          >
            {status}
          </Badge>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Gain potentiel</span>
            <span className="font-semibold tabular-nums text-success">
              {formatAmount(summary.potentialReturn)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-border pt-2.5">
        <p className="text-xs text-muted-foreground">
          {betSlip.items
            .slice(0, 2)
            .map((item) => item.fixture)
            .join(" • ")}
          {betSlip.items.length > 2 ? ` • +${betSlip.items.length - 2}` : ""}
        </p>
      </div>
    </button>
  );
}

export function BetSlipListPageClient() {
  const [filterState, setFilterState] = useState<FilterState>({
    type: "ALL",
    from: daysAgoIso(7),
    to: todayIso(),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const from = (filterState.from as string) || "";
  const to = (filterState.to as string) || "";
  const typeFilter = ((filterState.type as string) || "ALL") as SlipTypeFilter;

  const { data } = useBetSlips(from, to);
  const betSlips = useMemo(() => data ?? [], [data]);
  const isMobile = useIsMobile();

  const selectedSlip = betSlips.find((s) => s.id === selectedId) ?? null;
  const filteredBetSlips = useMemo(
    () =>
      typeFilter === "ALL"
        ? betSlips
        : betSlips.filter((slip) => slip.type === typeFilter),
    [betSlips, typeFilter],
  );

  const periodSummary = useMemo(
    () =>
      betSlips.reduce(
        (acc, slip) => {
          const summary = couponSummary(slip);
          acc.stake += summary.totalStake;
          acc.pending += summary.pendingCount > 0 ? 1 : 0;
          if (slip.type === "COMBO") acc.combo += 1;
          if (summary.pendingCount === 0) acc.net += summary.netPnl;
          return acc;
        },
        { stake: 0, net: 0, pending: 0, combo: 0 },
      ),
    [betSlips],
  );

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleClose() {
    setSelectedId(null);
  }

  const filter = (
    <div className="shrink-0 flex flex-col gap-4 rounded-[1.1rem] border border-border bg-panel p-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          compact
          tone="neutral"
          label="Misé"
          value={formatAmount(periodSummary.stake)}
        />
        <StatCard
          compact
          tone={periodSummary.net >= 0 ? "success" : "danger"}
          label="Net réglé"
          value={`${periodSummary.net >= 0 ? "+" : ""}${formatAmount(periodSummary.net)}`}
        />
        <StatCard
          compact
          tone="warning"
          label="En attente"
          value={String(periodSummary.pending)}
        />
      </div>
      <FilterBar
        filters={SLIP_FILTERS}
        value={filterState}
        onChange={setFilterState}
        onReset={() =>
          setFilterState({ type: "ALL", from: daysAgoIso(7), to: todayIso() })
        }
      />
    </div>
  );

  const items =
    filteredBetSlips.length === 0 ? (
      <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
        <EmptyHeader>
          <EmptyTitle>Aucun coupon</EmptyTitle>
          <EmptyDescription>
            Aucun coupon ne correspond à cette période et à ce filtre.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {filteredBetSlips.map((betSlip) => (
          <BetSlipCard
            key={betSlip.id}
            betSlip={betSlip}
            selected={betSlip.id === selectedId}
            onClick={() => handleSelect(betSlip.id)}
          />
        ))}
      </div>
    );

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="hidden min-h-0 flex-1 xl:grid xl:grid-cols-[3fr_2fr] xl:gap-5">
          <div className="flex min-h-0 flex-col gap-4">
            {filter}
            <div className="min-h-0 flex-1 overflow-y-auto">{items}</div>
          </div>
          <div className="h-full">
            {selectedSlip ? (
              <BetSlipDetailPanel data={selectedSlip} onClose={handleClose} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-[1.35rem] border border-dashed border-border bg-secondary">
                <p className="text-sm text-muted-foreground">
                  Sélectionnez un coupon pour voir le détail
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 xl:hidden">
          {filter}
          <div className="min-h-0 flex-1 overflow-y-auto">{items}</div>
        </div>
      </PageContent>

      {isMobile && (
        <Drawer.Root
          open={selectedSlip !== null}
          onOpenChange={(open) => !open && handleClose()}
        >
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
            <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-panel outline-none">
              <Drawer.Title className="sr-only">Détail du coupon</Drawer.Title>
              <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border" />
              {selectedSlip && (
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
                  <BetSlipDetailPanel
                    data={selectedSlip}
                    onClose={handleClose}
                  />
                </div>
              )}
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </Page>
  );
}
