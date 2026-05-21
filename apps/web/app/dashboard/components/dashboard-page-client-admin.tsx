"use client";

import { useState } from "react";
import {
  Page,
  PageContent,
  FilterBar,
  type FilterDef,
  type FilterState,
} from "@evcore/ui";
import { CanalCards } from "./canal-cards";
import { ChannelPerformanceTable } from "./channel-performance-table";
import { PredictionsCard } from "./predictions-card";
import { CompetitionRanking } from "./competition-ranking";
import { UserLeaderboard } from "./user-leaderboard";
import { useCompetitionStats } from "@/domains/dashboard/use-cases/get-competition-stats";
import { useLeaderboard } from "@/domains/dashboard/use-cases/get-leaderboard";

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

  const range = filters.range as DateRange | undefined;
  const fromIso = range?.from ? isoDate(range.from) : isoDate(thirtyDaysAgo());
  const toIso = range?.to ? isoDate(range.to) : isoDate(todayDate());

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
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
            {/* Row 1 : Canal cards pleine largeur */}
            <div className="col-span-2 sm:col-span-6 lg:col-span-12">
              <CanalCards from={fromIso} to={toIso} />
            </div>

            {/* Row 2 : Table perf (7) + Prédictions (5) */}
            <div className="col-span-2 sm:col-span-6 lg:col-span-7">
              <ChannelPerformanceTable />
            </div>
            <div className="col-span-2 sm:col-span-6 lg:col-span-5 flex flex-col">
              <PredictionsCard />
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
