"use client";

import { useState } from "react";
import {
  Page,
  PageContent,
  FilterBar,
  type FilterDef,
  type FilterState,
} from "@evcore/ui";
import { ChannelStatusStrip } from "./channel-status-strip";
import { CompetitionRanking } from "./competition-ranking";
import { UserLeaderboard } from "./user-leaderboard";
import { PipelineStatus } from "./pipeline-status";
import { ActiveAlerts } from "./active-alerts";
import { useCompetitionStats } from "@/domains/dashboard/use-cases/get-competition-stats";
import { useLeaderboard } from "@/domains/dashboard/use-cases/get-leaderboard";
import { useDashboardSummary } from "@/domains/dashboard/use-cases/get-dashboard-summary";

const FILTER_DEFS: FilterDef[] = [
  { key: "range", label: "Période", type: "daterange" },
];

function todayDate() {
  return new Date();
}
function thirtyDaysAgo() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d;
}

type DateRange = { from?: Date; to?: Date };

const DEFAULT_FILTERS: FilterState = {
  range: { from: thirtyDaysAgo(), to: todayDate() } satisfies DateRange,
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function DashboardPageClientAdmin() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
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

  const range = filters.range as DateRange | undefined;
  const fromIso = range?.from ? isoDate(range.from) : isoDate(thirtyDaysAgo());
  const toIso = range?.to ? isoDate(range.to) : isoDate(todayDate());

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-4">
          {/* Filter */}
          <FilterBar
            filters={FILTER_DEFS}
            value={filters}
            onChange={setFilters}
            onReset={() => setFilters(DEFAULT_FILTERS)}
            className="[&>div]:w-[260px]"
          />

          {/* ── Bento grid principal ── */}
          <div className="bento-grid">
            {/* Row 1 : Santé des canaux (aperçu, détail sur /performance) */}
            <div className="col-span-2 sm:col-span-6 lg:col-span-12">
              <ChannelStatusStrip from={fromIso} to={toIso} />
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
