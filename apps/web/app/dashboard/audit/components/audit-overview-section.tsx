"use client";

import { useTranslations } from "next-intl";
import type { AuditOverview } from "@/domains/audit/types/audit";
import { CountCard } from "./count-card";
import { LeagueBreakdown } from "./league-breakdown";
import { BetsBreakdown } from "./bets-breakdown";

export function AuditOverviewSection({
  overview,
}: {
  overview: AuditOverview;
}) {
  const t = useTranslations("audit");
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CountCard label={t("fixtures")} value={overview.counts.fixtures} />
        <CountCard label={t("modelRuns")} value={overview.counts.modelRuns} />
        <CountCard label={t("bets")} value={overview.counts.bets} />
        <CountCard label={t("settledBets")} value={overview.settledBets} />
      </div>

      <LeagueBreakdown rows={overview.leagueBreakdown} />

      <BetsBreakdown
        betsByStatus={overview.betsByStatus}
        betsByMarket={overview.betsByMarket}
        settledBets={overview.settledBets}
        adjustmentProposals={overview.adjustmentProposals}
        activeSuspensions={overview.activeSuspensions}
      />
    </div>
  );
}
