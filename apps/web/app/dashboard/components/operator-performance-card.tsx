"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useOperatorSummary } from "@/domains/bet-slip/use-cases/get-operator-summary";
import { useIsMobile } from "@/hooks/use-mobile";

function RoiBadge({ roi, count }: { roi: string; count: number }) {
  const t = useTranslations("dashboard.operatorCard");
  const value = parseFloat(roi);
  const isPositive = value > 0;
  const isNeutral = value >= -5 && value <= 0;
  const label = isPositive
    ? t("winForm")
    : isNeutral
      ? t("neutral")
      : t("toWatch");
  const cls = isPositive
    ? "bg-success/10 text-success border-success/30"
    : isNeutral
      ? "bg-warning/10 text-warning border-warning/30"
      : "bg-danger/10 text-danger border-danger/30";
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      <span className="tabular-nums">{roi}</span>
      <span className="font-normal opacity-70">
        · {count} pari{count > 1 ? "s" : ""} · {label}
      </span>
    </div>
  );
}

export function OperatorPerformanceCard() {
  const t = useTranslations("dashboard.operatorCard");
  const tPerf = useTranslations("performance");
  const [date, setDate] = useState<string | undefined>(undefined);
  const { data, isLoading } = useOperatorSummary(date);
  const isMobile = useIsMobile();

  const slotCls = `min-w-0 rounded-[1.15rem] border border-border bg-panel ${isMobile ? "px-2.5 py-2.5" : "rounded-2xl px-4 py-3"}`;
  const labelCls = `${isMobile ? "text-[0.56rem] tracking-[0.16em]" : "text-[0.68rem] tracking-[0.2em]"} font-semibold uppercase text-muted-foreground`;
  const valueCls = `${isMobile ? "mt-1 text-[0.95rem] leading-none" : "mt-1 text-[1.45rem] sm:text-[1.6rem]"} font-semibold tabular-nums tracking-tight text-foreground`;
  const subCls = `${isMobile ? "mt-1 text-[0.63rem]" : "mt-0.5 text-xs"} text-muted-foreground`;

  const skeleton = (
    <div className="h-8 w-12 animate-pulse rounded-lg bg-secondary" />
  );

  return (
    <section className="rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("headline")}
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
            {t("title")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date ?? ""}
            onChange={(e) =>
              setDate(e.target.value !== "" ? e.target.value : undefined)
            }
            className="h-9 cursor-pointer rounded-xl border border-border bg-panel px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {date && (
            <button
              type="button"
              onClick={() => setDate(undefined)}
              className="h-9 cursor-pointer rounded-xl border border-border bg-panel px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("allTime")}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
        <div className={slotCls}>
          <p className={labelCls}>{t("slips")}</p>
          {isLoading ? (
            skeleton
          ) : (
            <p className={valueCls}>{data?.slipCount ?? 0}</p>
          )}
          <p className={subCls}>{t("created")}</p>
        </div>

        <div className={slotCls}>
          <p className={labelCls}>{tPerf("settledShort")}</p>
          {isLoading ? (
            skeleton
          ) : (
            <p className={valueCls}>{data?.settledBets ?? 0}</p>
          )}
          <p className={subCls}>{isMobile ? t("settled") : t("settledLong")}</p>
        </div>

        <div className={slotCls}>
          <p className={labelCls}>{t("winRate")}</p>
          {isLoading ? (
            skeleton
          ) : (
            <p className={valueCls}>{data?.winRate ?? "—"}</p>
          )}
          <p className={subCls}>
            {data
              ? `${data.wonBets} ${tPerf("won")} · ${data.lostBets} ${tPerf("lost")}`
              : "—"}
          </p>
        </div>
      </div>

      {data && data.settledBets > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-success">
              {data.wonBets} {tPerf("won")}
            </span>
            <span className="text-xs font-semibold text-danger">
              {data.lostBets} {tPerf("lost")}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-success transition-all duration-500"
              style={{
                width: `${Math.round((data.wonBets / data.settledBets) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {data && data.pendingBets > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {data.pendingBets} pari{data.pendingBets > 1 ? "s" : ""} en attente de
          résultat
        </p>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {t("modelReturn")}
          </span>
          {isLoading ? (
            <div className="h-5 w-16 animate-pulse rounded-lg bg-secondary" />
          ) : data?.globalRoi != null ? (
            <RoiBadge roi={data.globalRoi} count={data.globalRoiBetCount} />
          ) : (
            <span className="text-xs text-muted-foreground">
              {t("notEnoughData")}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
