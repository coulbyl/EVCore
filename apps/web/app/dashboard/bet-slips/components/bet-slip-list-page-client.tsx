"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { Badge, EmptyState, Page, PageContent } from "@evcore/ui";
import { formatDateLong, todayIso, daysAgoIso } from "@/lib/date";
import { useBetSlips } from "@/domains/bet-slip/use-cases/get-bet-slips";
import { useIsMobile } from "@/hooks/use-mobile";
import type { BetSlipView } from "@/domains/bet-slip/types/bet-slip";
import { BetSlipDetailPanel } from "./bet-slip-detail-panel";

function formatAmount(value: string | number) {
  return Number(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function ticketPnlSummary(betSlip: BetSlipView) {
  let realPnl = 0;
  let settledCount = 0;
  let pendingCount = 0;
  for (const item of betSlip.items) {
    if (item.betStatus === "WON" || item.betStatus === "LOST") {
      settledCount++;
      if (item.pnl !== null) realPnl += Number(item.pnl);
    } else {
      pendingCount++;
    }
  }
  return { realPnl, settledCount, pendingCount };
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
  const { realPnl, settledCount, pendingCount } = ticketPnlSummary(betSlip);
  const totalStake = betSlip.items.reduce((sum, i) => sum + Number(i.stake), 0);
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
            Ticket
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">
            #{betSlip.id.slice(0, 8)}
          </h2>
        </div>
        <Badge tone="accent">{betSlip.itemCount} paris</Badge>
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
            {formatAmount(totalStake)}
          </span>
        </div>
        {(isFullySettled || isPartial) && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">
              {isPartial ? "Résultat partiel" : "Résultat"}
            </span>
            <span
              className={`font-bold tabular-nums ${
                realPnl >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {realPnl >= 0 ? "+" : ""}
              {formatAmount(realPnl)}
            </span>
          </div>
        )}
        {pendingCount > 0 && settledCount === 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Statut</span>
            <span className="text-xs text-slate-400">En attente</span>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data } = useBetSlips(from, to);
  const betSlips = data ?? [];
  const isMobile = useIsMobile();

  const selectedSlip = betSlips.find((s) => s.id === selectedId) ?? null;

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleClose() {
    setSelectedId(null);
  }

  const filter = (
    <div className="shrink-0 rounded-[1.1rem] border border-border bg-white px-4 py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
          Période
        </span>
        <span className="text-[0.72rem] text-slate-400">
          {betSlips.length} ticket{betSlips.length !== 1 ? "s" : ""}
        </span>
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
  );

  const items =
    betSlips.length === 0 ? (
      <EmptyState
        title="Aucun ticket"
        description="Aucun ticket créé sur cette période. Modifiez les dates ou créez un ticket depuis la page Matchs."
      />
    ) : (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {betSlips.map((betSlip) => (
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
                  Sélectionnez un ticket pour voir le détail
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
              <Drawer.Title className="sr-only">Détail du ticket</Drawer.Title>
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
