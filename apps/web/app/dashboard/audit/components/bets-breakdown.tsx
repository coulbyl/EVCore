import type { AuditOverview } from "@/domains/audit/types/audit";

export function BetsBreakdown({
  betsByStatus,
  betsByMarket,
  settledBets,
  adjustmentProposals,
  activeSuspensions,
}: Pick<
  AuditOverview,
  | "betsByStatus"
  | "betsByMarket"
  | "settledBets"
  | "adjustmentProposals"
  | "activeSuspensions"
>) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-[1.3rem] border border-border bg-white p-4">
        <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Paris par statut
        </p>
        <div className="space-y-1.5">
          {betsByStatus.map((r) => (
            <div key={r.status} className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">
                {r.status}
              </span>
              <span className="font-semibold tabular-nums text-slate-700">
                {r.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.3rem] border border-border bg-white p-4">
        <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Paris par marché
        </p>
        <div className="space-y-1.5">
          {betsByMarket.map((r) => (
            <div key={r.market} className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">
                {r.market}
              </span>
              <span className="font-semibold tabular-nums text-slate-700">
                {r.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.3rem] border border-border bg-white p-4">
        <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Boucle d&apos;apprentissage
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Paris réglés</span>
            <span
              className={`font-semibold tabular-nums ${settledBets >= 50 ? "text-emerald-600" : "text-amber-600"}`}
            >
              {settledBets}
              {settledBets < 50 && (
                <span className="ml-1 text-[0.65rem] font-normal text-slate-400">
                  / 50
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Propositions</span>
            <span className="font-semibold tabular-nums text-slate-700">
              {adjustmentProposals}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Suspensions actives</span>
            <span
              className={`font-semibold tabular-nums ${activeSuspensions > 0 ? "text-rose-600" : "text-slate-700"}`}
            >
              {activeSuspensions}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
