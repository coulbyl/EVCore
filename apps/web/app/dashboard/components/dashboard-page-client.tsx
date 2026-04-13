"use client";

import { useState } from "react";
import { Page, PageContent } from "@evcore/ui";
import { useDashboardSummary } from "@/domains/dashboard/use-cases/get-dashboard-summary";
import { useCompetitionStats } from "@/domains/dashboard/use-cases/get-competition-stats";
import { useLeaderboard } from "@/domains/dashboard/use-cases/get-leaderboard";
import { ActiveAlerts } from "./active-alerts";
import { CompetitionRanking } from "./competition-ranking";
import { EMPTY_SUMMARY } from "./dashboard-constants";
import { KpiCards } from "./kpi-cards";
import { PerformanceCard } from "./performance-card";
import { OperatorPerformanceCard } from "./operator-performance-card";
import { PipelineStatus } from "./pipeline-status";
import { UserLeaderboard } from "./user-leaderboard";

export function DashboardPageClient({ isAdmin }: { isAdmin: boolean }) {
  const [pnlDate, setPnlDate] = useState<string | undefined>(undefined);
  const { data } = useDashboardSummary(pnlDate);
  const { data: competitionStats } = useCompetitionStats();
  const { data: leaderboard } = useLeaderboard();

  const {
    dashboardKpis: kpis,
    workerStatuses: workers,
    activeAlerts: alerts,
    pnlSummary: pnl,
  } = data ?? EMPTY_SUMMARY;
  const visibleKpis = isAdmin
    ? kpis
    : kpis.filter((item) => item.label !== "Alertes actives");

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="space-y-5">
          {isAdmin ? (
            <PerformanceCard
              pnl={pnl}
              pnlDate={pnlDate}
              onDateChange={setPnlDate}
              onResetDate={() => setPnlDate(undefined)}
            />
          ) : (
            <OperatorPerformanceCard />
          )}

          <KpiCards items={visibleKpis} />

          {isAdmin ? (
            <div className="grid gap-5 xl:grid-cols-2">
              <PipelineStatus workers={workers} />
              <ActiveAlerts alerts={alerts} />
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-2">
            <CompetitionRanking stats={competitionStats ?? []} />
            <UserLeaderboard entries={leaderboard ?? []} />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
