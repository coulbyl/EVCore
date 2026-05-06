"use client";

import { useState } from "react";
import { Page, PageContent } from "@evcore/ui";
import { FilterBar, type FilterDef, type FilterState } from "@evcore/ui";
import { CanalCards } from "./canal-cards";
import { DashboardSharedSection } from "./dashboard-shared-section";

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

  const range = filters.range as DateRange | undefined;
  const fromIso = range?.from ? isoDate(range.from) : isoDate(thirtyDaysAgo());
  const toIso = range?.to ? isoDate(range.to) : isoDate(todayDate());

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5">
          <FilterBar
            filters={FILTER_DEFS}
            value={filters}
            onChange={setFilters}
            onReset={() => setFilters(DEFAULT_FILTERS)}
            className="[&>div]:w-[260px]"
          />

          <CanalCards from={fromIso} to={toIso} />

          <DashboardSharedSection />
        </div>
      </PageContent>
    </Page>
  );
}
