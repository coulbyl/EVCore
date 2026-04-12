"use client";

import { useState } from "react";
import { useOperatorSummary } from "@/domains/bet-slip/use-cases/get-operator-summary";
import { useIsMobile } from "@/hooks/use-mobile";

export function OperatorPerformanceCard() {
  const [date, setDate] = useState<string | undefined>(undefined);
  const { data, isLoading } = useOperatorSummary(date);
  const isMobile = useIsMobile();

  const slotCls = `min-w-0 rounded-[1.15rem] border border-border bg-slate-50 ${isMobile ? "px-2.5 py-2.5" : "rounded-2xl px-4 py-3"}`;
  const labelCls = `${isMobile ? "text-[0.56rem] tracking-[0.16em]" : "text-[0.68rem] tracking-[0.2em]"} font-semibold uppercase text-slate-500`;
  const valueCls = `${isMobile ? "mt-1 text-[0.95rem] leading-none" : "mt-1 text-[1.45rem] sm:text-[1.6rem]"} font-semibold tabular-nums tracking-tight text-slate-700`;
  const subCls = `${isMobile ? "mt-1 text-[0.63rem]" : "mt-0.5 text-xs"} text-slate-400`;

  const skeleton = (
    <div className="h-8 w-12 animate-pulse rounded-lg bg-slate-200" />
  );

  return (
    <section className="rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Mes performances
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
            Résumé de mes slips
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date ?? ""}
            onChange={(e) =>
              setDate(e.target.value !== "" ? e.target.value : undefined)
            }
            className="h-9 cursor-pointer rounded-xl border border-border bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {date && (
            <button
              type="button"
              onClick={() => setDate(undefined)}
              className="h-9 cursor-pointer rounded-xl border border-border bg-white px-3 text-xs text-slate-500 hover:text-slate-800"
            >
              Tout
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
        <div className={slotCls}>
          <p className={labelCls}>Slips</p>
          {isLoading ? (
            skeleton
          ) : (
            <p className={valueCls}>{data?.slipCount ?? 0}</p>
          )}
          <p className={subCls}>créés</p>
        </div>

        <div className={slotCls}>
          <p className={labelCls}>Bets</p>
          {isLoading ? (
            skeleton
          ) : (
            <p className={valueCls}>{data?.settledBets ?? 0}</p>
          )}
          <p className={subCls}>{isMobile ? "settlés" : "bets settlés"}</p>
        </div>

        <div className={slotCls}>
          <p className={labelCls}>Réussite</p>
          {isLoading ? (
            skeleton
          ) : (
            <p className={valueCls}>{data?.winRate ?? "—"}</p>
          )}
          <p className={subCls}>
            {data ? `${data.wonBets}W · ${data.lostBets}L` : "—"}
          </p>
        </div>
      </div>

      {data && data.settledBets > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-emerald-600">
              {data.wonBets} gagnés
            </span>
            <span className="text-xs font-semibold text-rose-500">
              {data.lostBets} perdus
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-rose-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{
                width: `${Math.round((data.wonBets / data.settledBets) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {data && data.pendingBets > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          {data.pendingBets} bet{data.pendingBets > 1 ? "s" : ""} en attente de
          résultat
        </p>
      )}
    </section>
  );
}
