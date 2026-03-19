"use client";

import { useMemo, useState } from "react";
import { Drawer } from "vaul";
import type { CouponSnapshot } from "../types/dashboard";
import {
  CouponDetailLeg,
  CouponDetailStats,
  combinedOdds,
} from "./coupon-detail";



// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

type CouponStatus = CouponSnapshot["status"];
type SelectionStatus = CouponSnapshot["selections"][number]["status"];
type Status = CouponStatus | SelectionStatus;

const STATUS_CFG: Record<
  Status,
  { label: string; dot: string; badge: string; headerBadge: string }
> = {
  WON: {
    label: "GAGNÉ",
    dot: "bg-emerald-400",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    headerBadge: "border-emerald-400/40 bg-emerald-400/20 text-emerald-300",
  },
  LOST: {
    label: "PERDU",
    dot: "bg-rose-400",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    headerBadge: "border-rose-400/40 bg-rose-400/20 text-rose-300",
  },
  PENDING: {
    label: "EN COURS",
    dot: "bg-amber-400",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    headerBadge: "border-amber-400/40 bg-amber-400/20 text-amber-300",
  },
  VOID: {
    label: "VOID",
    dot: "bg-slate-400",
    badge: "border-slate-200 bg-slate-100 text-slate-600",
    headerBadge: "border-slate-400/40 bg-slate-400/20 text-slate-300",
  },
};

function evColor(ev: string) {
  const n = parseFloat(ev);
  if (n > 0) return "text-emerald-500";
  if (n < 0) return "text-rose-500";
  return "text-slate-500";
}

// ---------------------------------------------------------------------------
// Coupon row (list)
// ---------------------------------------------------------------------------

function CouponRow({
  coupon,
  onOpen,
}: {
  coupon: CouponSnapshot;
  onOpen: () => void;
}) {
  const cfg = STATUS_CFG[coupon.status];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full cursor-pointer rounded-2xl border border-border bg-panel-strong px-4 py-3 text-left transition-all duration-150 hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`mt-px size-2 shrink-0 rounded-full ${cfg.dot}`} />
          <span className="truncate font-mono text-[11px] text-slate-400">
            {coupon.code}
          </span>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${cfg.badge}`}
          >
            {cfg.label}
          </span>
        </div>
        <span className="shrink-0 text-slate-300 transition-transform duration-150 group-hover:translate-x-0.5">
          ›
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-3 pl-[18px]">
        <span className="text-xs text-slate-500">
          {coupon.legs} sélection{coupon.legs > 1 ? "s" : ""}
        </span>
        <span className="text-slate-300">•</span>
        <span className="text-xs text-slate-500">{coupon.window}</span>
        <span className="text-slate-300">•</span>
        <span
          className={`text-xs font-semibold tabular-nums ${evColor(coupon.ev)}`}
        >
          EV {coupon.ev}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Drawer — ticket style
// ---------------------------------------------------------------------------


function CouponDrawerContent({
  coupon,
  onClose,
}: {
  coupon: CouponSnapshot;
  onClose: () => void;
}) {
  const cfg = STATUS_CFG[coupon.status];
  const isCombined = coupon.selections.length > 1;
  const odds = isCombined
    ? combinedOdds(coupon.selections.map((s) => s.odds))
    : (coupon.selections[0]?.odds ?? "—");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Dark header */}
      <div className="shrink-0 rounded-b-3xl bg-sidebar px-6 pb-5 pt-5 shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Coupon EVCore
            </p>
            <Drawer.Title className="mt-1.5 font-mono text-base font-bold text-white">
              {coupon.code}
            </Drawer.Title>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>

        {/* Status + window */}
        <div className="mt-3 flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${cfg.headerBadge}`}
          >
            <span className={`size-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          <span className="text-xs text-slate-400">{coupon.window}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-panel-strong">
        <div className="m-4 overflow-hidden rounded-2xl border border-border bg-white">
          <CouponDetailStats
            selectionCount={coupon.selections.length}
            isCombined={isCombined}
            odds={odds}
            ev={coupon.ev}
          />
          <div className="divide-y divide-border">
            {coupon.selections.length > 0 ? (
              coupon.selections.map((sel, i) => (
                <CouponDetailLeg key={sel.id} selection={sel} index={i} />
              ))
            ) : (
              <p className="px-4 py-6 text-sm text-slate-400">
                Aucune sélection disponible.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

export function RecentCouponsCard({
  snapshots,
}: {
  snapshots: CouponSnapshot[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selected = useMemo(
    () => snapshots.find((c) => c.id === selectedId) ?? null,
    [selectedId, snapshots],
  );

  function open(id: string) {
    setSelectedId(id);
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setSelectedId(null);
  }

  return (
    <div className="rounded-[1.8rem] border border-border bg-panel-strong p-6 ev-shell-shadow">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Coupons récents
          </p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900">
            Coupons générés
          </h2>
        </div>
        {snapshots.length > 5 && (
          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-slate-400">
            {snapshots.length} au total
          </span>
        )}
      </div>

      {/* List — 5 items visible, scroll pour le reste */}
      <div className="mt-4 flex max-h-95 flex-col gap-2 overflow-y-auto pr-1">
        {snapshots.length > 0 ? (
          snapshots.map((coupon) => (
            <CouponRow
              key={coupon.id}
              coupon={coupon}
              onOpen={() => open(coupon.id)}
            />
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-slate-400">
            Aucun coupon généré
          </p>
        )}
      </div>

      {/* Drawer */}
      <Drawer.Root
        direction="right"
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px]" />
          <Drawer.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-105 flex-col overflow-hidden bg-panel-strong shadow-2xl">
            {selected ? (
              <CouponDrawerContent coupon={selected} onClose={close} />
            ) : null}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
