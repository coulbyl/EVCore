"use client";

import { Page, PageContent } from "@evcore/ui";
import { AppPageHeader } from "../../components/app-page-header";

export default function AuditPage() {
  return (
    <Page className="flex h-full flex-col">
      <AppPageHeader
        currentPageLabel="Audit"
        subtitle="Traçabilité des runs, événements et corrections"
        backendLabel="OK"
        onRefresh={() => {}}
      />

      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-5 ev-shell-shadow">
        <section className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Journal d&apos;audit
          </p>
          <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-slate-400">
            Layout prêt. Brancher la liste des événements d'audit ici.
          </div>
        </section>
      </PageContent>
    </Page>
  );
}
