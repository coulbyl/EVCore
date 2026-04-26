"use client";

import { X } from "lucide-react";
import { EvBadge } from "@evcore/ui";
import {
  formatMarketForDisplay,
  formatCombinedPickForDisplay,
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

function totalOdds(data: BetSlipView) {
  return data.items.reduce((product, item) => {
    const odds = Number(item.odds ?? 1);
    return Number.isFinite(odds) && odds > 0 ? product * odds : product;
  }, 1);
}

type ItemStatus = "WON" | "LOST" | "PENDING" | "VOID";

const STATUS_BAR: Record<ItemStatus, string> = {
  WON: "bg-emerald-400",
  LOST: "bg-rose-400",
  PENDING: "bg-amber-400",
  VOID: "bg-slate-300",
};

const STATUS_LABEL: Record<ItemStatus, string> = {
  WON: "Gagné",
  LOST: "Perdu",
  PENDING: "En attente",
  VOID: "Annulé",
};

function PnlDisplay({
  item,
  slipType,
}: {
  item: BetSlipItemView;
  slipType: BetSlipView["type"];
}) {
  if (slipType === "COMBO") return null;
  if (item.pnl !== null) {
    const raw = Number(item.pnl);
    const isPos = raw >= 0;
    return (
      <p
        className={`text-base font-bold tabular-nums ${isPos ? "text-emerald-600" : "text-rose-600"}`}
      >
        {isPos ? "+" : ""}
        {raw.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
      </p>
    );
  }
  if (item.betStatus === "VOID") return null;
  if (item.odds !== null) {
    const potential = (
      Number(item.stake) *
      (Number(item.odds) - 1)
    ).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
    return (
      <p className="text-sm tabular-nums text-slate-400">+{potential} pot.</p>
    );
  }
  return <p className="text-xs text-slate-400">—</p>;
}

function BetItem({
  item,
  slipType,
}: {
  item: BetSlipItemView;
  slipType: BetSlipView["type"];
}) {
  const status = item.betStatus as ItemStatus;
  const bar = STATUS_BAR[status] ?? "bg-slate-300";

  const pickLabel = formatCombinedPickForDisplay({
    market: item.market,
    pick: item.pick,
    comboMarket: item.comboMarket ?? undefined,
    comboPick: item.comboPick ?? undefined,
  });
  const marketLabel = formatMarketForDisplay(item.market);

  return (
    <div className="flex gap-0 overflow-hidden">
      {/* Left status bar */}
      <div className={`w-1 shrink-0 rounded-l-sm ${bar}`} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3.5">
        {/* Row 1: fixture + score */}
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
            {item.fixture}
          </p>
          {item.homeScore !== null && item.awayScore !== null ? (
            <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-600">
              {item.homeScore} – {item.awayScore}
            </span>
          ) : null}
        </div>

        {/* Row 2: pick + market */}
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-700">{pickLabel}</span>
          <span className="mx-1 text-slate-300">·</span>
          {marketLabel}
        </p>

        {/* Row 3: metrics + P&L */}
        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            {item.odds ? (
              <span>
                Cote{" "}
                <span className="font-semibold text-slate-600">
                  {item.odds}
                </span>
              </span>
            ) : null}
            <span>
              EV{" "}
              <span className="font-semibold text-emerald-600">
                {item.ev.startsWith("+") ? item.ev : `+${item.ev}`}
              </span>
            </span>
            <span>
              {slipType === "COMBO" ? (
                "Leg combiné"
              ) : (
                <>
                  Mise{" "}
                  <span className="font-semibold text-slate-600">
                    {formatAmount(item.stake)}
                  </span>
                </>
              )}
            </span>
            {slipType === "SIMPLE" && item.stakeOverride ? (
              <EvBadge tone="warning" className="py-0 text-[0.65rem]">
                Perso {formatAmount(item.stakeOverride)}
              </EvBadge>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <PnlDisplay item={item} slipType={slipType} />
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
              {STATUS_LABEL[status]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BetSlipDetailPanel({
  data,
  onClose,
}: {
  data: BetSlipView;
  onClose: () => void;
}) {
  const totalStake =
    data.type === "COMBO"
      ? Number(data.unitStake)
      : data.items.reduce((sum, item) => sum + Number(item.stake), 0);
  const settledItems = data.items.filter(
    (i) => i.betStatus === "WON" || i.betStatus === "LOST",
  );
  const pendingCount =
    data.type === "COMBO"
      ? data.items.some((i) => i.betStatus === "PENDING")
        ? 1
        : 0
      : data.items.length - settledItems.length;
  const comboAllWon = data.items.every((i) => i.betStatus === "WON");
  const comboTotalOdds = totalOdds(data);
  const pendingSelections = data.items.filter(
    (i) => i.betStatus === "PENDING",
  ).length;
  const realPnl =
    data.type === "COMBO"
      ? pendingCount === 0
        ? comboAllWon
          ? totalStake * comboTotalOdds - totalStake
          : -totalStake
        : 0
      : settledItems.reduce((sum, item) => {
          if (item.pnl === null) return sum;
          return sum + Number(item.pnl);
        }, 0);
  const retourTotal =
    data.type === "COMBO"
      ? pendingCount === 0 && comboAllWon
        ? totalStake * comboTotalOdds
        : 0
      : settledItems
          .filter((i) => i.betStatus === "WON" && i.pnl !== null)
          .reduce((sum, i) => sum + Number(i.stake) + Number(i.pnl), 0);
  const hasPnl =
    data.type === "COMBO" ? pendingCount === 0 : settledItems.length > 0;
  const status =
    pendingCount > 0 ? "En attente" : realPnl >= 0 ? "Gagné" : "Perdu";
  const statusTone =
    pendingCount > 0 ? "warning" : realPnl >= 0 ? "success" : "danger";
  const potentialReturn =
    data.type === "COMBO"
      ? totalStake * comboTotalOdds
      : data.items.reduce((sum, item) => {
          const odds = Number(item.odds ?? 0);
          return Number.isFinite(odds) ? sum + Number(item.stake) * odds : sum;
        }, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border bg-panel-strong ev-shell-shadow">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Coupon
          </p>
          <p className="text-base font-semibold text-slate-900">
            #{data.id.slice(0, 8)}
          </p>
          <p className="text-xs font-semibold text-slate-600">
            {data.type === "COMBO" ? "Combiné" : "Simples"}
          </p>
          <p className="text-xs text-slate-500">
            {formatDateLong(data.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EvBadge tone={statusTone}>{status}</EvBadge>
          <EvBadge tone="accent">
            {data.itemCount} sélection{data.itemCount > 1 ? "s" : ""}
          </EvBadge>
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
          {data.type === "COMBO" && (
            <DetailRow label="Cote totale" value={comboTotalOdds.toFixed(2)} />
          )}
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
            <>
              <DetailRow
                label="Gain potentiel"
                value={formatAmount(String(potentialReturn))}
              />
              <p className="text-xs text-slate-400">
                {pendingSelections} sélection
                {pendingSelections > 1 ? "s" : ""} en attente de résultat
              </p>
            </>
          )}
        </div>

        {/* Items */}
        <div className="max-h-96 lg:max-h-128 overflow-y-auto divide-y divide-border">
          {data.items.map((item) => (
            <BetItem key={item.betId} item={item} slipType={data.type} />
          ))}
        </div>
      </div>
    </div>
  );
}
