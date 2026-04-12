"use client";

import { formatCompactValue } from "@/helpers/number";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PnlSummary } from "@/domains/dashboard/types/dashboard";

export function PerformanceCard({
  pnl,
  pnlDate,
  onDateChange,
  onResetDate,
}: {
  pnl: PnlSummary;
  pnlDate?: string;
  onDateChange: (value?: string) => void;
  onResetDate: () => void;
}) {
  const isMobile = useIsMobile();
  const lostBets = Math.max(0, pnl.settledBets - pnl.wonBets);
  const netUnits = Number.parseFloat(pnl.netUnits.replace(",", "."));
  const roiPct = Number.parseFloat(pnl.roi.replace(",", "."));
  const winBarPct =
    pnl.settledBets > 0 ? Math.round((pnl.wonBets / pnl.settledBets) * 100) : 0;
  const compactSettledBets = formatCompactValue(pnl.settledBets);
  const compactRoi = isMobile ? formatCompactValue(pnl.roi) : pnl.roi;
  const compactNetUnits = isMobile
    ? formatCompactValue(pnl.netUnits)
    : pnl.netUnits;

  return (
    <section className="rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Performance globale
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
            Gains &amp; pertes
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {pnl.settledBets === 0 && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              En attente de résultats
            </span>
          )}
          <input
            type="date"
            value={pnlDate ?? ""}
            onChange={(e) =>
              onDateChange(e.target.value !== "" ? e.target.value : undefined)
            }
            className="h-9 rounded-xl border border-border bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {pnlDate && (
            <button
              type="button"
              onClick={onResetDate}
              className="h-9 rounded-xl border border-border bg-white px-3 text-xs text-slate-500 hover:text-slate-800"
            >
              Tout
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
        <div
          className={`min-w-0 rounded-[1.15rem] border ${isMobile ? "px-2.5 py-2.5" : "rounded-2xl px-4 py-3"} ${Number.isFinite(roiPct) && roiPct > 0 ? "border-emerald-200 bg-emerald-50" : Number.isFinite(roiPct) && roiPct < 0 ? "border-rose-200 bg-rose-50" : "border-border bg-slate-50"}`}
        >
          <p
            className={`${isMobile ? "text-[0.56rem] tracking-[0.16em]" : "text-[0.68rem] tracking-[0.2em]"} font-semibold uppercase text-slate-500`}
          >
            ROI
          </p>
          <p
            className={`${isMobile ? "mt-1 text-[0.95rem] leading-none" : "mt-1 text-[1.45rem] sm:text-[1.6rem]"} font-semibold tabular-nums tracking-tight ${Number.isFinite(roiPct) && roiPct > 0 ? "text-emerald-700" : Number.isFinite(roiPct) && roiPct < 0 ? "text-rose-700" : "text-slate-700"}`}
          >
            {compactRoi}
          </p>
          <p
            className={`${isMobile ? "mt-1 text-[0.63rem]" : "mt-0.5 text-xs"} text-slate-400`}
          >
            {isMobile ? "capital" : "sur capital misé"}
          </p>
        </div>

        <div
          className={`min-w-0 rounded-[1.15rem] border ${isMobile ? "px-2.5 py-2.5" : "rounded-2xl px-4 py-3"} ${Number.isFinite(netUnits) && netUnits > 0 ? "border-emerald-200 bg-emerald-50" : Number.isFinite(netUnits) && netUnits < 0 ? "border-rose-200 bg-rose-50" : "border-border bg-slate-50"}`}
        >
          <p
            className={`${isMobile ? "text-[0.56rem] tracking-[0.16em]" : "text-[0.68rem] tracking-[0.2em]"} font-semibold uppercase text-slate-500`}
          >
            Gain net
          </p>
          <p
            className={`${isMobile ? "mt-1 text-[0.95rem] leading-none" : "mt-1 text-[1.45rem] sm:text-[1.6rem]"} font-semibold tabular-nums tracking-tight ${Number.isFinite(netUnits) && netUnits > 0 ? "text-emerald-700" : Number.isFinite(netUnits) && netUnits < 0 ? "text-rose-700" : "text-slate-700"}`}
          >
            {compactNetUnits}
          </p>
          <p
            className={`${isMobile ? "mt-1 text-[0.63rem]" : "mt-0.5 text-xs"} text-slate-400`}
          >
            {isMobile ? "stake" : "unités de stake"}
          </p>
        </div>

        <div
          className={`min-w-0 rounded-[1.15rem] border border-border bg-slate-50 ${isMobile ? "px-2.5 py-2.5" : "rounded-2xl px-4 py-3"}`}
        >
          <p
            className={`${isMobile ? "text-[0.56rem] tracking-[0.16em]" : "text-[0.68rem] tracking-[0.2em]"} font-semibold uppercase text-slate-500`}
          >
            Réussite
          </p>
          <p
            className={`${isMobile ? "mt-1 text-[0.95rem] leading-none" : "mt-1 text-[1.45rem] sm:text-[1.6rem]"} font-semibold tabular-nums tracking-tight text-slate-700`}
          >
            {pnl.winRate}
          </p>
          <p
            className={`${isMobile ? "mt-1 text-[0.63rem]" : "mt-0.5 text-xs"} text-slate-400`}
          >
            {compactSettledBets} {isMobile ? "settlés" : "bets settlés"}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-emerald-600">
            {pnl.wonBets} gagnés
          </span>
          <span className="text-xs font-semibold text-rose-500">
            {lostBets} perdus
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-rose-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${winBarPct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
