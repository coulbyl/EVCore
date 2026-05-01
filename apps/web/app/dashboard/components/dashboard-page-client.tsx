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
import { CanalCards } from "./canal-cards";
import { Announcements } from "@/components/announcements";
import { GraduationCap } from "lucide-react";
import { useTranslations } from "next-intl";

export function DashboardPageClient({ isAdmin }: { isAdmin: boolean }) {
  const tFormation = useTranslations("dashboard.announcements.formation");
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
  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5">
          <Announcements
            items={[
              {
                id: "formation",
                icon: <GraduationCap size={16} />,
                title: tFormation("title"),
                description: tFormation("description"),
                href: "/dashboard/formation",
              },
            ]}
          />

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

          {isAdmin && <KpiCards items={kpis} />}

          {isAdmin ? (
            <div className="grid gap-5 xl:grid-cols-2">
              <PipelineStatus workers={workers} />
              <ActiveAlerts alerts={alerts} />
            </div>
          ) : null}

          <CanalCards pnl={pnl} />

          <div className="grid gap-5 xl:grid-cols-2">
            <CompetitionRanking stats={competitionStats ?? []} />
            <UserLeaderboard entries={leaderboard ?? []} />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
