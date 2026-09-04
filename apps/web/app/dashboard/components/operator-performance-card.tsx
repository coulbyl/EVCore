"use client";

import { useTranslations } from "next-intl";
import { StatCard, Skeleton } from "@evcore/ui";
import { useOperatorSummary } from "@/domains/bet-slip/use-cases/get-operator-summary";

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

  return (
    <section className="ev-shell-shadow rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5">
      <div className="min-w-0">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {t("headline")}
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
          {t("title")}
        </h2>
      </div>

      {isLoading ? (
        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
          <StatCard
            label={t("slips")}
            value={String(data?.slipCount ?? 0)}
            delta={t("created")}
            tone="accent"
            compact
          />
          <StatCard
            label={tPerf("settledShort")}
            value={String(data?.settledBets ?? 0)}
            delta={data && data.settledBets > 0
              ? `${data.wonBets} ${tPerf("won")} · ${data.lostBets} ${tPerf("lost")}`
              : t("settledLong")}
            tone="neutral"
            compact
          />
          <StatCard
            label={t("winRate")}
            value={data?.winRate ?? "—"}
            delta={
              data && data.pendingBets > 0
                ? `${data.pendingBets} en attente`
                : undefined
            }
            tone={
              data && data.settledBets > 0 && Number.parseFloat(data.winRate) >= 50
                ? "success"
                : "warning"
            }
            compact
          />
        </div>
      )}

      {data && data.settledBets > 0 && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-success transition-all duration-500"
              style={{
                width: `${Math.round((data.wonBets / data.settledBets) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
