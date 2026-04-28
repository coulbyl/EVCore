"use client";

import { StatCard } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { useDashboardSummary } from "@/domains/dashboard/use-cases/get-dashboard-summary";

export function OverviewSection() {
  const t = useTranslations("performancePage");
  const { data } = useDashboardSummary();
  const pnl = data?.pnlSummary;

  return (
    <section>
      <div className="mb-4">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {t("title")}
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
          {t("overview")}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="ROI" value={pnl?.roi ?? "—"} tone="accent" />
        <StatCard
          label={t("stats.winRate")}
          value={pnl?.winRate ?? "—"}
          tone="success"
        />
        <StatCard
          label={t("stats.netUnits")}
          value={pnl?.netUnits ?? "—"}
          tone="neutral"
        />
        <StatCard
          label={t("stats.settledBets")}
          value={pnl ? String(pnl.settledBets) : "—"}
          tone="neutral"
        />
      </div>
    </section>
  );
}
