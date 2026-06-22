"use client";

import { useState } from "react";
import { StatCard, Tabs, TabsList, TabsTrigger } from "@evcore/ui";
import { useTranslations } from "next-intl";
import {
  usePnlByCanalByPeriod,
  type PnlPeriod,
} from "@/domains/dashboard/use-cases/get-pnl-by-canal";

const PERIODS: { value: PnlPeriod; labelKey: string }[] = [
  { value: "7d", labelKey: "period7d" },
  { value: "30d", labelKey: "period30d" },
  { value: "all", labelKey: "periodAll" },
];

type Canal = "global" | "value" | "safe";

export function OverviewSection() {
  const t = useTranslations("performancePage");
  const [period, setPeriod] = useState<PnlPeriod>("30d");
  const [canal, setCanal] = useState<Canal>("global");
  const { data, isLoading } = usePnlByCanalByPeriod(period);

  const pnl = isLoading ? undefined : data?.[canal];

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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={canal} onValueChange={(v) => setCanal(v as Canal)}>
          <TabsList>
            <TabsTrigger value="global">{t("canalGlobal")}</TabsTrigger>
            <TabsTrigger value="value">{t("canalValue")}</TabsTrigger>
            <TabsTrigger value="safe">{t("canalSafe")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={period} onValueChange={(v) => setPeriod(v as PnlPeriod)}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>
                {t(p.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
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
