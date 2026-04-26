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
  const roiTone =
    Number.isFinite(roiPct) && roiPct > 0
      ? {
          card: "border-success/30 bg-success/10",
          value: "text-success",
        }
      : Number.isFinite(roiPct) && roiPct < 0
        ? {
            card: "border-danger/30 bg-danger/10",
            value: "text-danger",
          }
        : {
            card: "border-border bg-panel",
            value: "text-foreground",
          };
  const netTone =
    Number.isFinite(netUnits) && netUnits > 0
      ? {
          card: "border-success/30 bg-success/10",
          value: "text-success",
        }
      : Number.isFinite(netUnits) && netUnits < 0
        ? {
            card: "border-danger/30 bg-danger/10",
            value: "text-danger",
          }
        : {
            card: "border-border bg-panel",
            value: "text-foreground",
          };

  return (
    <section className="rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Performance globale
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
            Gains &amp; pertes
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {pnl.settledBets === 0 && (
            <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
              En attente de résultats
            </span>
          )}
          <input
            type="date"
            value={pnlDate ?? ""}
            onChange={(e) =>
              onDateChange(e.target.value !== "" ? e.target.value : undefined)
            }
            className="h-9 rounded-xl border border-border bg-panel px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {pnlDate && (
            <button
              type="button"
              onClick={onResetDate}
              className="h-9 rounded-xl border border-border bg-panel px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Tout
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
        <div
          className={`min-w-0 rounded-[1.15rem] border ${isMobile ? "px-2.5 py-2.5" : "rounded-2xl px-4 py-3"} ${roiTone.card}`}
        >
          <p
            className={`${isMobile ? "text-[0.56rem] tracking-[0.16em]" : "text-[0.68rem] tracking-[0.2em]"} font-semibold uppercase text-muted-foreground`}
          >
            ROI
          </p>
          <p
            className={`${isMobile ? "mt-1 text-[0.95rem] leading-none" : "mt-1 text-[1.45rem] sm:text-[1.6rem]"} font-semibold tabular-nums tracking-tight ${roiTone.value}`}
          >
            {compactRoi}
          </p>
          <p
            className={`${isMobile ? "mt-1 text-[0.63rem]" : "mt-0.5 text-xs"} text-muted-foreground`}
          >
            {isMobile ? "capital" : "sur capital misé"}
          </p>
        </div>

        <div
          className={`min-w-0 rounded-[1.15rem] border ${isMobile ? "px-2.5 py-2.5" : "rounded-2xl px-4 py-3"} ${netTone.card}`}
        >
          <p
            className={`${isMobile ? "text-[0.56rem] tracking-[0.16em]" : "text-[0.68rem] tracking-[0.2em]"} font-semibold uppercase text-muted-foreground`}
          >
            Gain net
          </p>
          <p
            className={`${isMobile ? "mt-1 text-[0.95rem] leading-none" : "mt-1 text-[1.45rem] sm:text-[1.6rem]"} font-semibold tabular-nums tracking-tight ${netTone.value}`}
          >
            {compactNetUnits}
          </p>
          <p
            className={`${isMobile ? "mt-1 text-[0.63rem]" : "mt-0.5 text-xs"} text-muted-foreground`}
          >
            {isMobile ? "mise" : "unités de mise"}
          </p>
        </div>

        <div
          className={`min-w-0 rounded-[1.15rem] border border-border bg-panel ${isMobile ? "px-2.5 py-2.5" : "rounded-2xl px-4 py-3"}`}
        >
          <p
            className={`${isMobile ? "text-[0.56rem] tracking-[0.16em]" : "text-[0.68rem] tracking-[0.2em]"} font-semibold uppercase text-muted-foreground`}
          >
            Réussite
          </p>
          <p
            className={`${isMobile ? "mt-1 text-[0.95rem] leading-none" : "mt-1 text-[1.45rem] sm:text-[1.6rem]"} font-semibold tabular-nums tracking-tight text-foreground`}
          >
            {pnl.winRate}
          </p>
          <p
            className={`${isMobile ? "mt-1 text-[0.63rem]" : "mt-0.5 text-xs"} text-muted-foreground`}
          >
            {compactSettledBets} {isMobile ? "réglés" : "paris réglés"}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-success">
            {pnl.wonBets} gagnés
          </span>
          <span className="text-xs font-semibold text-danger">
            {lostBets} perdus
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-success transition-all duration-500"
            style={{ width: `${winBarPct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
