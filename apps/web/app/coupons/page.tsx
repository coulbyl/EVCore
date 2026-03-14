"use client";

import { Page, PageContent } from "@evcore/ui";
import { AppPageHeader } from "../../components/app-page-header";

const PLACEHOLDER_ROWS = [
  { code: "CPN-2026-03-14-01", legs: "4", status: "EN COURS", ev: "+6.4%" },
  { code: "CPN-2026-03-13-09", legs: "3", status: "GAGNÉ", ev: "+4.1%" },
  { code: "CPN-2026-03-13-08", legs: "5", status: "PERDU", ev: "-2.3%" },
];

export default function CouponsPage() {
  return (
    <Page className="flex h-full flex-col">
      <AppPageHeader
        currentPageLabel="Coupons"
        subtitle="Gestion des coupons et suivi des résultats"
        backendLabel="OK"
        onRefresh={() => {}}
      />

      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-5 ev-shell-shadow">
        <div className="space-y-5">
          <section className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Filtres
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              {["Période", "Statut", "Nombre de legs", "Compétition"].map(
                (label) => (
                  <div
                    key={label}
                    className="rounded-xl border border-border bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  >
                    {label}
                  </div>
                ),
              )}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
            <div className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Liste des coupons
                  </p>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                    Coupons récents
                  </h2>
                </div>
              </div>
              <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-white">
                {PLACEHOLDER_ROWS.map((row) => (
                  <div
                    key={row.code}
                    className="grid grid-cols-[1.5fr_0.5fr_0.7fr_0.6fr] gap-3 px-4 py-3 text-sm"
                  >
                    <span className="font-mono text-slate-600">{row.code}</span>
                    <span className="text-slate-500">{row.legs} legs</span>
                    <span className="text-slate-500">{row.status}</span>
                    <span className="font-semibold text-slate-700">
                      {row.ev}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Détail coupon
              </p>
              <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-slate-400">
                Sélectionnez un coupon pour afficher le détail.
              </div>
            </aside>
          </section>

          <section className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Historique
            </p>
            <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-slate-400">
              Zone réservée aux métriques d'historique des coupons.
            </div>
          </section>
        </div>
      </PageContent>
    </Page>
  );
}
