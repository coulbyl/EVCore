"use client";

import { X } from "lucide-react";
import { Badge } from "@evcore/ui";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import { formatDateLong } from "@/lib/date";
import type {
  BetSlipView,
  BetSlipItemView,
} from "@/domains/bet-slip/types/bet-slip";

function formatAmount(value: string | number) {
  return Number(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function ResultBadge({ item }: { item: BetSlipItemView }) {
  if (item.pnl !== null) {
    const isPositive = item.pnl.startsWith("+");
    const amount = formatAmount(item.pnl.replace("+", "").replace("-", ""));
    return (
      <Badge tone={isPositive ? "success" : "danger"}>
        {isPositive ? `+${amount} · Gagné` : `−${amount} · Perdu`}
      </Badge>
    );
  }
  if (item.betStatus === "VOID") return <Badge tone="neutral">Annulé</Badge>;
  if (item.odds !== null) {
    const potential = (
      Number(item.stake) *
      (Number(item.odds) - 1)
    ).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
    return <Badge tone="neutral">+{potential} potentiel</Badge>;
  }
  return <Badge tone="neutral">En attente</Badge>;
}

export function BetSlipDetailPanel({
  data,
  onClose,
}: {
  data: BetSlipView;
  onClose: () => void;
}) {
  const totalStake = data.items.reduce(
    (sum, item) => sum + Number(item.stake),
    0,
  );
  const settledItems = data.items.filter(
    (i) => i.betStatus === "WON" || i.betStatus === "LOST",
  );
  const pendingCount = data.items.length - settledItems.length;
  const realPnl = settledItems.reduce((sum, item) => {
    if (item.pnl === null) return sum;
    return sum + Number(item.pnl);
  }, 0);
  const retourTotal = settledItems
    .filter((i) => i.betStatus === "WON" && i.pnl !== null)
    .reduce((sum, i) => sum + Number(i.stake) + Number(i.pnl), 0);
  const hasPnl = settledItems.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border bg-panel-strong ev-shell-shadow">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Ticket
          </p>
          <p className="text-base font-semibold text-slate-900">
            #{data.id.slice(0, 8)}
          </p>
          <p className="text-xs text-slate-500">
            {formatDateLong(data.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="accent">{data.itemCount} paris</Badge>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-slate-400 transition-colors hover:text-slate-700"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Summary */}
        <div className="space-y-2.5 border-b border-border px-4 py-4">
          <DetailRow label="Utilisateur" value={`@${data.username}`} />
          <DetailRow
            label="Mise par sélection"
            value={formatAmount(data.unitStake)}
          />
          <DetailRow
            label="Total misé"
            value={formatAmount(String(totalStake))}
          />
          {hasPnl && (
            <>
              <div
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                  realPnl >= 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                <span>
                  {pendingCount > 0 ? "Gain net partiel" : "Gain net"}
                </span>
                <span className="tabular-nums">
                  {realPnl >= 0 ? "+" : ""}
                  {realPnl.toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              {retourTotal > 0 && (
                <DetailRow
                  label="Retour total"
                  value={retourTotal.toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                  })}
                />
              )}
            </>
          )}
          {pendingCount > 0 && (
            <p className="text-xs text-slate-400">
              {pendingCount} sélection{pendingCount > 1 ? "s" : ""} en attente
              de résultat
            </p>
          )}
        </div>

        {/* Items */}
        <div className="divide-y divide-border">
          {data.items.map((item) => (
            <div key={item.betId} className="px-4 py-3.5">
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.fixture}
                    </p>
                    {item.homeScore !== null && item.awayScore !== null && (
                      <span className="mr-2 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-700">
                        {item.homeScore} – {item.awayScore}
                      </span>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {formatPickForDisplay(item.pick, item.market)} •{" "}
                      {formatMarketForDisplay(item.market)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <ResultBadge item={item} />
                  {item.odds ? (
                    <Badge tone="neutral">Cote {item.odds}</Badge>
                  ) : null}
                  <Badge tone="success">Valeur {item.ev}</Badge>
                  <Badge tone="accent">Mise {formatAmount(item.stake)}</Badge>
                  {item.stakeOverride ? (
                    <Badge tone="warning">
                      Mise perso {formatAmount(item.stakeOverride)}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
