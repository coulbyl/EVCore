"use client";

import Link from "next/link";
import { Badge, EmptyState, Page, PageContent } from "@evcore/ui";
import { formatDateLong } from "@/lib/date";
import { useBetSlips } from "@/domains/bet-slip/use-cases/get-bet-slips";
import type { BetSlipView } from "@/domains/bet-slip/types/bet-slip";

function formatAmount(value: string | number) {
  return Number(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function ticketPnlSummary(betSlip: BetSlipView): {
  realPnl: number;
  settledCount: number;
  pendingCount: number;
} {
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

export function BetSlipListPageClient() {
  const { data } = useBetSlips();
  const betSlips = data ?? [];

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        {betSlips.length === 0 ? (
          <EmptyState
            title="Aucun ticket"
            description="Créez votre premier ticket depuis la page Matchs pour commencer à suivre vos sélections."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {betSlips.map((betSlip) => {
              const { realPnl, settledCount, pendingCount } =
                ticketPnlSummary(betSlip);
              const totalStake = Number(betSlip.unitStake) * betSlip.itemCount;
              const isPartial = settledCount > 0 && pendingCount > 0;
              const isFullySettled = settledCount > 0 && pendingCount === 0;

              return (
                <Link
                  key={betSlip.id}
                  href={`/dashboard/bet-slips/${betSlip.id}`}
                  className="rounded-2xl border border-border bg-white p-4 transition-colors hover:bg-slate-50"
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

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Créé le</span>
                      <span className="font-medium text-slate-800">
                        {formatDateLong(betSlip.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Mise par sélection</span>
                      <span className="font-semibold tabular-nums text-slate-900">
                        {formatAmount(betSlip.unitStake)}
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
                        <span className="text-xs text-slate-400">
                          En attente
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t border-border pt-3">
                    <p className="text-xs text-slate-500">
                      {betSlip.items
                        .slice(0, 2)
                        .map((item) => item.fixture)
                        .join(" • ")}
                      {betSlip.items.length > 2
                        ? ` • +${betSlip.items.length - 2}`
                        : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </PageContent>
    </Page>
  );
}
