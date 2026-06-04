"use client";

import { Suspense } from "react";
import {
  Badge,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Page,
  PageContent,
} from "@evcore/ui";
import { AlertCircle, Database, LoaderCircle } from "lucide-react";
import { useAuditOverview } from "@/domains/audit/use-cases/get-audit-overview";
import { AuditOverviewSection } from "./components/audit-overview-section";

function AuditPageContent() {
  const { data: overview, error, isError, isLoading } = useAuditOverview();

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <section className="rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Vue d&apos;ensemble
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                Snapshot DB
              </h2>
            </div>
            {overview && (
              <Badge variant="neutral">
                {new Date(overview.generatedAt).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "UTC",
                })}{" "}
                UTC
              </Badge>
            )}
          </div>
          <div className="mt-4">
            {isLoading ? (
              <Empty className="rounded-2xl border-dashed bg-panel/70 px-4 py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <LoaderCircle className="animate-spin" />
                  </EmptyMedia>
                  <EmptyTitle>Chargement de l&apos;audit</EmptyTitle>
                  <EmptyDescription>
                    Récupération du snapshot et des métriques de couverture.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : isError ? (
              <Empty className="rounded-2xl border-dashed bg-panel/70 px-4 py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <AlertCircle />
                  </EmptyMedia>
                  <EmptyTitle>Audit indisponible</EmptyTitle>
                  <EmptyDescription>
                    {error instanceof Error
                      ? error.message
                      : "Impossible de charger l'audit pour le moment."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : overview ? (
              <AuditOverviewSection overview={overview} />
            ) : (
              <Empty className="rounded-2xl border-dashed bg-panel/70 px-4 py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Database />
                  </EmptyMedia>
                  <EmptyTitle>Aucune donnée d&apos;audit</EmptyTitle>
                  <EmptyDescription>
                    Le snapshot n&apos;a retourné aucun indicateur exploitable.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </section>
      </PageContent>
    </Page>
  );
}

export default function AuditPage() {
  return (
    <Suspense>
      <AuditPageContent />
    </Suspense>
  );
}
