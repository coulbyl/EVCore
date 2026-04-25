"use client";

import { useMemo, useState } from "react";
import { Drawer } from "vaul";
import { Badge, EmptyState, Page, PageContent } from "@evcore/ui";
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

  let returned = 0;
  let settledCount = 0;
  let pendingCount = 0;
  let totalStake = 0;
  let settledStake = 0;
  let potentialReturn = 0;

  for (const item of betSlip.items) {
    const stake = Number(item.stake);
    const odds = Number(item.odds ?? 0);
    totalStake += stake;
    if (Number.isFinite(odds)) potentialReturn += stake * odds;
    if (item.betStatus === "WON" || item.betStatus === "LOST") {
      settledCount++;
      settledStake += stake;
      if (item.betStatus === "WON" && item.odds !== null) {
        returned += stake * Number(item.odds);
      }
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
          : "border-border bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Coupon
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">
            #{betSlip.id.slice(0, 8)}
          </h2>
        </div>
        <Badge tone="accent">
          {betSlip.type === "COMBO" ? "Combiné" : "Simples"} ·{" "}
          {betSlip.itemCount} sélection{betSlip.itemCount > 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Créé le</span>
          <span className="font-medium text-slate-800">
            {formatDateLong(betSlip.createdAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Total misé</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {formatAmount(summary.totalStake)}
          </span>
        </div>
        {betSlip.type === "COMBO" && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Cote totale</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {summary.totalOdds?.toFixed(2)}
            </span>
          </div>
        )}
        {(isFullySettled || isPartial) && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">
              {isPartial ? "Résultat partiel" : "Résultat"}
            </span>
            <span
              className={`font-bold tabular-nums ${
                summary.netPnl >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {summary.netPnl >= 0 ? "+" : ""}
              {formatAmount(summary.netPnl)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Statut</span>
          <Badge tone={summary.statusTone} className="py-0.5 text-[0.62rem]">
            {status}
          </Badge>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Gain potentiel</span>
            <span className="font-semibold tabular-nums text-emerald-600">
              {formatAmount(summary.potentialReturn)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-border pt-2.5">
        <p className="text-xs text-slate-500">
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
  const [from, setFrom] = useState(() => daysAgoIso(7));
  const [to, setTo] = useState(todayIso);
  const [typeFilter, setTypeFilter] = useState<SlipTypeFilter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const periodSummary = useMemo(() => {
    return betSlips.reduce(
      (acc, slip) => {
        const summary = couponSummary(slip);
        acc.stake += summary.totalStake;
        acc.pending += summary.pendingCount > 0 ? 1 : 0;
        if (slip.type === "COMBO") acc.combo += 1;
        if (summary.pendingCount === 0) acc.net += summary.netPnl;
        return acc;
      },
      { stake: 0, net: 0, pending: 0, combo: 0 },
    );
  }, [betSlips]);

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleClose() {
    setSelectedId(null);
  }

  const filter = (
    <div className="shrink-0 rounded-[1.1rem] border border-border bg-white px-4 py-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
            Coupons
          </span>
          <p className="mt-1 text-xs text-slate-500">
            {betSlips.length} coupon{betSlips.length !== 1 ? "s" : ""} ·{" "}
            {periodSummary.combo} combiné{periodSummary.combo > 1 ? "s" : ""}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs">
          <div>
            <p className="text-slate-400">Misé</p>
            <p className="font-bold tabular-nums text-slate-900">
              {formatAmount(periodSummary.stake)}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Net réglé</p>
            <p
              className={`font-bold tabular-nums ${
                periodSummary.net >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {periodSummary.net >= 0 ? "+" : ""}
              {formatAmount(periodSummary.net)}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Attente</p>
            <p className="font-bold tabular-nums text-amber-600">
              {periodSummary.pending}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
          {[
            ["ALL", "Tous"],
            ["SIMPLE", "Simples"],
            ["COMBO", "Combinés"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTypeFilter(value as SlipTypeFilter)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                typeFilter === value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 w-full max-w-40 min-w-0 rounded-lg border border-border bg-slate-50 px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <span className="shrink-0 text-slate-300">→</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-full max-w-40 min-w-0 rounded-lg border border-border bg-slate-50 px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
      </div>
    </div>
  );

  const items =
    filteredBetSlips.length === 0 ? (
      <EmptyState
        title="Aucun coupon"
        description="Aucun coupon ne correspond à cette période et à ce filtre."
      />
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
        {/* Desktop : grid [colonne gauche 60% | aside 40%] */}
        <div className="hidden min-h-0 flex-1 xl:grid xl:grid-cols-[3fr_2fr] xl:gap-5">
          {/* Colonne gauche : filtre fixe + liste scrollable */}
          <div className="flex min-h-0 flex-col gap-4">
            {filter}
            <div className="min-h-0 flex-1 overflow-y-auto">{items}</div>
          </div>
          {/* Colonne droite : panel de détail */}
          <div className="h-full">
            {selectedSlip ? (
              <BetSlipDetailPanel data={selectedSlip} onClose={handleClose} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-[1.35rem] border border-dashed border-slate-200 bg-slate-50">
                <p className="text-sm text-slate-400">
                  Sélectionnez un coupon pour voir le détail
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile : filtre fixe + liste scrollable */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 xl:hidden">
          {filter}
          <div className="min-h-0 flex-1 overflow-y-auto">{items}</div>
        </div>
      </PageContent>

      {/* Mobile bottom sheet */}
      {isMobile && (
        <Drawer.Root
          open={selectedSlip !== null}
          onOpenChange={(open) => !open && handleClose()}
        >
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
            <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white outline-none">
              <Drawer.Title className="sr-only">Détail du coupon</Drawer.Title>
              <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-slate-300" />
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
