"use client";

import { useEtlQueueStatus } from "@/domains/etl/use-cases/use-etl";
import { QueueStatusSection } from "./queue-status-section";
import { GlobalActionsSection } from "./global-actions-section";
import { AnalysisSection } from "./analysis-section";
import { LeagueOpsSection } from "./league-ops-section";

export function EnginePageClient() {
  const { data: queueStatus, isLoading: isQueueLoading } = useEtlQueueStatus();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">Moteur & ETL</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestion des jobs ETL, queues BullMQ et moteur de pari.
        </p>
      </div>

      <QueueStatusSection data={queueStatus} isLoading={isQueueLoading} />
      <GlobalActionsSection />
      <AnalysisSection />
      <LeagueOpsSection />
    </div>
  );
}
