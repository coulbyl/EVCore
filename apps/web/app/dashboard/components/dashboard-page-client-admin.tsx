"use client";

import { Page, PageContent } from "@evcore/ui";
import { EngineHealthCard } from "./engine-health-card";
import { CompetitionRanking } from "./competition-ranking";
import { UserLeaderboard } from "./user-leaderboard";
import { PipelineStatus } from "./pipeline-status";
import { ActiveAlerts } from "./active-alerts";
import { useCompetitionStats } from "@/domains/dashboard/use-cases/get-competition-stats";
import { useLeaderboard } from "@/domains/dashboard/use-cases/get-leaderboard";
import { useDashboardSummary } from "@/domains/dashboard/use-cases/get-dashboard-summary";

// No date-range filter on this page — EngineHealthCard, CompetitionRanking,
// PipelineStatus and ActiveAlerts each manage their own fixed windows now
// that nothing here reads a shared range (the FilterBar this page used to
// have only ever fed ChannelStatusStrip, retired in favour of
// EngineHealthCard — see docs/dashboard-operator-admin-redesign-2026-09-04.md
// étape 2).
export function DashboardPageClientAdmin() {
  const {
    data: competitionStats,
    isLoading: competitionLoading,
    isError: competitionError,
  } = useCompetitionStats();
  const {
    data: leaderboard,
    isLoading: leaderboardLoading,
    isError: leaderboardError,
  } = useLeaderboard();
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useDashboardSummary();

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-4">
          {/* ── Bento grid principal ── */}
          <div className="bento-grid">
            {/* Row 1 : Santé moteur — statut global, calibration, canaux
                à risque, marchés suspendus (détail complet sur /performance) */}
            <div className="col-span-2 sm:col-span-6 lg:col-span-12">
              <EngineHealthCard />
            </div>

            {/* Row 2 : Pipeline + Alertes */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-6">
              <PipelineStatus
                workers={summary?.workerStatuses ?? []}
                isLoading={summaryLoading}
                isError={summaryError}
              />
            </div>
            <div className="col-span-2 sm:col-span-3 lg:col-span-6">
              <ActiveAlerts
                alerts={summary?.activeAlerts ?? []}
                isLoading={summaryLoading}
                isError={summaryError}
              />
            </div>

            {/* Row 3 : Classement ligues + Top joueurs */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-6">
              <CompetitionRanking
                stats={competitionStats ?? []}
                isLoading={competitionLoading}
                isError={competitionError}
              />
            </div>
            <div className="col-span-2 sm:col-span-3 lg:col-span-6">
              <UserLeaderboard
                entries={leaderboard ?? []}
                isLoading={leaderboardLoading}
                isError={leaderboardError}
              />
            </div>

          </div>
        </div>
      </PageContent>
    </Page>
  );
}
