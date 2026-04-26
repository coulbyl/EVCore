import { EvBadge, Page, PageContent } from "@evcore/ui";

export default function AccountSettingsPage() {
  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Compte
                </p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                  Paramètres opérateur
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Espace réservé à la configuration du compte et des préférences
                  applicatives.
                </p>
              </div>
              <EvBadge tone="neutral">Placeholder</EvBadge>
            </div>
          </section>

          <aside className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
              À venir
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="rounded-xl border border-border bg-slate-50 px-4 py-3">
                Préférences d&apos;interface
              </li>
              <li className="rounded-xl border border-border bg-slate-50 px-4 py-3">
                Paramètres opérateur
              </li>
              <li className="rounded-xl border border-border bg-slate-50 px-4 py-3">
                Sécurité du compte
              </li>
            </ul>
          </aside>
        </div>
      </PageContent>
    </Page>
  );
}
