"use client";

import {
  PageHeader,
  PageHeaderTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@evcore/ui";
import { Activity, RotateCcw, Wrench, Zap } from "lucide-react";
import { useEtlQueueStatus } from "@/domains/etl/use-cases/use-etl";
import { QueueStatusSection } from "./queue-status-section";
import { GlobalActionsSection } from "./global-actions-section";
import { AnalysisSection } from "./analysis-section";
import { LeagueOpsSection } from "./league-ops-section";
import { GlobalBackfillSection } from "./global-backfill-section";
import { CouponSettlementSection } from "./coupon-settlement-section";
import { ChannelSelectionSettlementSection } from "./channel-selection-settlement-section";

export function EnginePageClient() {
  const { data: queueStatus, isLoading: isQueueLoading } = useEtlQueueStatus();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader>
        <div>
          <PageHeaderTitle className="text-xl font-bold">
            Moteur & ETL
          </PageHeaderTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestion des jobs ETL, queues BullMQ et moteur de pari.
          </p>
        </div>
      </PageHeader>

      <Tabs defaultValue="monitoring">
        {/* Tab list — scrollable on mobile, same pattern as account-tabs-client */}
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <TabsList className="w-max">
            <TabsTrigger value="monitoring">
              <Activity data-icon="inline-start" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="actions">
              <Zap data-icon="inline-start" />
              Actions
            </TabsTrigger>
            <TabsTrigger value="operations">
              <Wrench data-icon="inline-start" />
              Opérations
            </TabsTrigger>
            <TabsTrigger value="catchup">
              <RotateCcw data-icon="inline-start" />
              Rattrapage
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="monitoring" className="mt-6">
          <QueueStatusSection data={queueStatus} isLoading={isQueueLoading} />
        </TabsContent>

        <TabsContent value="actions" className="mt-6 flex flex-col gap-8">
          <GlobalActionsSection />
          <AnalysisSection />
        </TabsContent>

        <TabsContent value="operations" className="mt-6 flex flex-col gap-8">
          <LeagueOpsSection />
          <GlobalBackfillSection />
        </TabsContent>

        <TabsContent value="catchup" className="mt-6 flex flex-col gap-8">
          <CouponSettlementSection />
          <ChannelSelectionSettlementSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
