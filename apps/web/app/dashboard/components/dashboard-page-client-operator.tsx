"use client";

import { useState } from "react";
import {
  Page,
  PageContent,
  FilterBar,
  Skeleton,
  type FilterDef,
  type FilterState,
} from "@evcore/ui";
import { OperatorPerformanceCard } from "./operator-performance-card";
import { WeeklyBrief } from "./weekly-brief";
import { Announcements } from "@/components/announcements";
import { CanalCards } from "./canal-cards";
import { CompetitionRanking } from "./competition-ranking";
import { UserLeaderboard } from "./user-leaderboard";
import { useCompetitionStats } from "@/domains/dashboard/use-cases/get-competition-stats";
import { useLeaderboard } from "@/domains/dashboard/use-cases/get-leaderboard";
import { useDashboardAnnouncements } from "@/domains/announcements/use-cases/get-dashboard-announcements";

const FILTER_DEFS: FilterDef[] = [
  { key: "range", label: "Période", type: "daterange" },
];

type DateRange = { from?: Date; to?: Date };

function todayDate() {
  return new Date();
}
function thirtyDaysAgo() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d;
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DEFAULT_FILTERS: FilterState = {
  range: { from: thirtyDaysAgo(), to: todayDate() } satisfies DateRange,
};

export function DashboardPageClientOperator() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const announcementsQuery = useDashboardAnnouncements();
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
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-4">
          {/* Announcements */}
          {announcementsQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
          ) : (
            <Announcements
              items={(announcementsQuery.data ?? []).map((item) => ({
                id: item.id,
                title: item.title,
                description: item.description,
                href: item.href ?? undefined,
              }))}
            />
          )}

          {/* Weekly brief — visible le lundi uniquement */}
          <WeeklyBrief />

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
            {/* Row 1 : Performance pleine largeur */}
            <div className="col-span-2 sm:col-span-6 lg:col-span-12 flex flex-col">
              <OperatorPerformanceCard from={fromIso} to={toIso} />
            </div>

            {/* Row 2 : Canal cards pleine largeur */}
            <div className="col-span-2 sm:col-span-6 lg:col-span-12">
              <CanalCards from={fromIso} to={toIso} />
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
