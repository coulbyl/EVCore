"use client";

import { useState } from "react";
import { Page, PageContent } from "@evcore/ui";
import { AppPageHeader } from "@/components/app-page-header";
import { FixtureDetailPanel } from "@/components/fixture-detail-panel";
import { OpportunitiesTable } from "@/components/opportunities-table";
import { toFixturePanel } from "@/domains/dashboard/helpers/to-fixture-panel";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDashboardSummary } from "@/domains/dashboard/use-cases/get-dashboard-summary";
import type { OpportunityRow } from "@/domains/dashboard/types/dashboard";
import { ActiveAlerts } from "./components/active-alerts";
import { EMPTY_SUMMARY } from "./components/dashboard-constants";
import { KpiCards } from "./components/kpi-cards";
import { PerformanceCard } from "./components/performance-card";
import { PipelineStatus } from "./components/pipeline-status";

export default function Home() {
  const isMobile = useIsMobile();
  const [pnlDate, setPnlDate] = useState<string | undefined>(undefined);
  const [selectedRow, setSelectedRow] = useState<OpportunityRow | null>(null);
  const { data, refetch, isFetching, isError } = useDashboardSummary(pnlDate);
  const {
    dashboardKpis: kpis,
    topOpportunities: opportunities,
    selectedFixture: apiFixture,
    workerStatuses: workers,
    activeAlerts: alerts,
    pnlSummary: pnl,
  } = data ?? EMPTY_SUMMARY;

  const fixture =
    selectedRow !== null ? toFixturePanel(selectedRow) : apiFixture;

  return (
    <Page className="flex h-full flex-col">
      <AppPageHeader
        currentPageLabel="Tableau de bord"
        subtitle="Tableau de bord"
        backendLabel={isError ? "indisponible" : "OK"}
        onRefresh={() => void refetch()}
        isRefreshing={isFetching}
      />

      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="space-y-5">
          <PerformanceCard
            pnl={pnl}
            pnlDate={pnlDate}
            onDateChange={setPnlDate}
            onResetDate={() => setPnlDate(undefined)}
          />

          <KpiCards items={kpis} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.72fr)_minmax(330px,0.88fr)]">
            <section className="space-y-5">
              <OpportunitiesTable
                rows={opportunities}
                selectedId={selectedRow?.id ?? null}
                onSelectAction={setSelectedRow}
              />
            </section>
            <aside className="space-y-5">
              {!isMobile ? <FixtureDetailPanel fixture={fixture} /> : null}
              <PipelineStatus workers={workers} />
              <ActiveAlerts alerts={alerts} />
            </aside>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
