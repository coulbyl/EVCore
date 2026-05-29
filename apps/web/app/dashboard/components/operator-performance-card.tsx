"use client";

import { useTranslations } from "next-intl";
import { useOperatorSummary } from "@/domains/bet-slip/use-cases/get-operator-summary";

const slotCls =
  "min-w-0 rounded-[1.15rem] border border-border bg-panel px-2.5 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3";
const labelCls =
  "text-[0.56rem] tracking-[0.16em] sm:text-[0.68rem] sm:tracking-[0.2em] font-semibold uppercase text-muted-foreground";
const valueCls =
  "mt-1 text-[0.95rem] leading-none sm:text-[1.45rem] lg:text-[1.6rem] font-semibold tabular-nums tracking-tight text-foreground";
const subCls = "mt-1 text-[0.63rem] sm:mt-0.5 sm:text-xs text-muted-foreground";


export function OperatorPerformanceCard({
  from,
  to,
}: {
  from?: string;
  to?: string;
}) {
  const t = useTranslations("dashboard.operatorCard");
  const tPerf = useTranslations("performance");
  const { data, isLoading } = useOperatorSummary(from, to);

  const skeleton = (
    <div className="h-8 w-12 animate-pulse rounded-lg bg-secondary" />
  );

  return (
    <section className="ev-shell-shadow rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("headline")}
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
            {t("title")}
          </h2>
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
          <p className={subCls}>
            <span className="sm:hidden">{t("settled")}</span>
            <span className="hidden sm:inline">{t("settledLong")}</span>
          </p>
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

    </section>
  );
}
