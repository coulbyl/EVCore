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
import { Announcements } from "@/components/announcements";
import { DashboardSharedSection } from "./dashboard-shared-section";
import { CanalCards } from "./canal-cards";
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

  const range = filters.range as DateRange | undefined;
  const fromIso = range?.from ? isoDate(range.from) : isoDate(thirtyDaysAgo());
  const toIso = range?.to ? isoDate(range.to) : isoDate(todayDate());

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5">
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

          <FilterBar
            filters={FILTER_DEFS}
            value={filters}
            onChange={setFilters}
            onReset={() => setFilters(DEFAULT_FILTERS)}
            className="[&>div]:w-[260px]"
          />

          <OperatorPerformanceCard from={fromIso} to={toIso} />

          <CanalCards from={fromIso} to={toIso} />

          <DashboardSharedSection />
        </div>
      </PageContent>
    </Page>
  );
}
