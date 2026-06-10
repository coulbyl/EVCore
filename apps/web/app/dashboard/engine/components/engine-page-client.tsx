"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@evcore/ui";
import { Activity, Wrench, Zap } from "lucide-react";
import { useEtlQueueStatus } from "@/domains/etl/use-cases/use-etl";
import { QueueStatusSection } from "./queue-status-section";
import { GlobalActionsSection } from "./global-actions-section";
import { AnalysisSection } from "./analysis-section";
import { LeagueOpsSection } from "./league-ops-section";

export function EnginePageClient() {
  const { data: queueStatus, isLoading: isQueueLoading } = useEtlQueueStatus();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Moteur & ETL</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestion des jobs ETL, queues BullMQ et moteur de pari.
        </p>
      </div>

      <Tabs defaultValue="monitoring">
        <TabsList>
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
        </TabsList>

        <TabsContent value="monitoring" className="mt-6">
          <QueueStatusSection data={queueStatus} isLoading={isQueueLoading} />
        </TabsContent>

        <TabsContent value="actions" className="mt-6 flex flex-col gap-8">
          <GlobalActionsSection />
          <AnalysisSection />
        </TabsContent>

        <TabsContent value="operations" className="mt-6">
          <LeagueOpsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
