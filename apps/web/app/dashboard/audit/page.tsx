"use client";

import { Suspense } from "react";
import { Badge, Page, PageContent } from "@evcore/ui";
import { useAuditOverview } from "@/domains/audit/use-cases/get-audit-overview";
import { AuditOverviewSection } from "./components/audit-overview-section";

function AuditPageContent() {
  const {
    data: overview,
    isFetching: overviewFetching,
    isError,
    refetch,
  } = useAuditOverview();

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <section className="rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Vue d&apos;ensemble
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                Snapshot DB
              </h2>
            </div>
            {overview && (
              <Badge tone="neutral">
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
            {overview ? (
              <AuditOverviewSection overview={overview} />
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-slate-400">
                Chargement…
              </div>
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
