"use client";

import {
  fixtureStatusBadgeClass,
  fixtureStatusLabel,
  formatCombinedPickForDisplay,
} from "@/helpers/fixture";
import { formatScore } from "@/domains/fixture/helpers/fixture";
import type {
  FixtureEvaluatedPickSnapshot,
  FixturePickSnapshot,
  FixtureRow,
} from "@/domains/fixture/types/fixture";

function rejectionReasonLabel(reason?: string): string {
  if (!reason) return "--";

  const labels: Record<string, string> = {
    odds_below_floor: "Cote trop basse",
    odds_above_cap: "Cote trop haute",
    ev_below_threshold: "Valeur insuffisante",
    ev_above_hard_cap: "Valeur au-dessus du plafond",
    ev_above_soft_cap: "Valeur au-dessus du plafond (calibration)",
    filtered_longshot: "Grande cote écartée",
    market_suspended: "Marché suspendu",
    probability_too_low: "Probabilité insuffisante",
    quality_score_below_threshold: "Qualité insuffisante",
  };

  return labels[reason] ?? reason;
}

function ModelInput({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="min-w-0 rounded-[0.9rem] bg-white/75 px-2 py-2 sm:px-3">
      <p className="truncate text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[0.62rem]">
        {label}
      </p>
      <p className="mt-1 truncate text-[0.92rem] font-semibold text-slate-900 sm:text-[1.02rem]">
        {value ?? "—"}
      </p>
    </div>
  );
}

function DiagnosticTable({
  title,
  rows,
  evaluated = false,
}: {
  title: string;
  rows: FixturePickSnapshot[] | FixtureEvaluatedPickSnapshot[];
  evaluated?: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {title}
      </p>
      <div className="overflow-x-auto rounded-[1.1rem] border border-slate-100 bg-white">
        <table className="min-w-[760px] w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
              <th className="sticky left-0 z-20 w-[152px] min-w-[152px] bg-white px-3 py-3 pr-3 shadow-[10px_0_14px_-14px_rgba(15,23,42,0.35)] sm:px-4 sm:pr-4">
                Marché
              </th>
              <th className="sticky left-[152px] z-20 w-[76px] min-w-[76px] bg-white px-3 py-3 pr-3 shadow-[10px_0_14px_-14px_rgba(15,23,42,0.2)] sm:px-4 sm:pr-4">
                Prob.
              </th>
              <th className="w-[82px] min-w-[82px] bg-white px-3 py-3 pr-3 sm:px-4 sm:pr-4 md:sticky md:left-[228px] md:z-20 md:shadow-[10px_0_14px_-14px_rgba(15,23,42,0.35)]">
                Cote
              </th>
              <th className="px-4 py-3 pr-4">Valeur</th>
              <th className="px-4 py-3 pr-4">Qualité</th>
              <th className="px-4 py-3 pr-4">Statut</th>
              <th className="px-4 py-3">Raison</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row, index) => {
              const snapshot = row as FixtureEvaluatedPickSnapshot;
              const isEvaluated = evaluated;
              const isViable = snapshot.status === "viable";

              return (
                <tr key={`${title}-${index}`} className="align-middle">
                  <td className="sticky left-0 z-10 min-w-[152px] bg-white px-3 py-3 pr-3 font-medium text-slate-800 shadow-[10px_0_14px_-14px_rgba(15,23,42,0.35)] sm:px-4 sm:pr-4">
                    {formatCombinedPickForDisplay(row)}
                  </td>
                  <td className="sticky left-[152px] z-10 min-w-[76px] bg-white px-3 py-3 pr-3 tabular-nums text-slate-700 shadow-[10px_0_14px_-14px_rgba(15,23,42,0.2)] sm:px-4 sm:pr-4">
                    {row.probability}
                  </td>
                  <td className="min-w-[82px] bg-white px-3 py-3 pr-3 tabular-nums text-slate-700 sm:px-4 sm:pr-4 md:sticky md:left-[228px] md:z-10 md:shadow-[10px_0_14px_-14px_rgba(15,23,42,0.35)]">
                    {row.odds}
                  </td>
                  <td className="px-4 py-3 pr-4 tabular-nums font-semibold text-emerald-600">
                    {row.ev}
                  </td>
                  <td className="px-4 py-3 pr-4 tabular-nums text-slate-700">
                    {row.qualityScore}
                  </td>
                  <td className="px-4 py-3 pr-4">
                    {isEvaluated ? (
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${
                          isViable
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-600"
                        }`}
                      >
                        {isViable ? "Viable" : "Rejeté"}
                      </span>
                    ) : (
                      <span className="text-slate-400">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[0.82rem] text-slate-500">
                    {isEvaluated
                      ? rejectionReasonLabel(snapshot.rejectionReason)
                      : "--"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FixtureDiagnostics({ row }: { row: FixtureRow }) {
  const mr = row.modelRun;
  const score = formatScore(row.score, row.htScore);

  if (!mr) {
    return (
      <div className="rounded-[1.7rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
        <p className="text-sm text-slate-500">Aucun diagnostic disponible.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.35rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      <div className="border-b border-slate-100 pb-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-base font-semibold leading-tight text-slate-900 sm:text-lg">
            {row.fixture}
          </p>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${fixtureStatusBadgeClass(row.status)}`}
          >
            {fixtureStatusLabel(row.status)}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {mr.pick && mr.market ? (
            <span className="font-medium text-slate-800">
              {formatCombinedPickForDisplay({
                market: mr.market,
                pick: mr.pick,
              })}
            </span>
          ) : (
            "Sélection non disponible"
          )}
          {score ? (
            <>
              {" · "}
              <span className="font-medium text-slate-700">{score}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Entrées modèle
        </p>
        <div className="grid grid-cols-4 gap-2 rounded-[1.1rem] border border-slate-100 bg-slate-50 px-2 py-2.5 sm:gap-3 sm:px-4 sm:py-4">
          <ModelInput label="Prob. estimée" value={mr.probEstimated} />
          <ModelInput label="λ Dom." value={mr.lambdaHome} />
          <ModelInput label="λ Ext." value={mr.lambdaAway} />
          <ModelInput label="Buts attendus" value={mr.expectedTotalGoals} />
        </div>
      </div>

      <DiagnosticTable
        title={`Sélections candidates (${mr.candidatePicks.length})`}
        rows={mr.candidatePicks}
      />
      <DiagnosticTable
        title={`Sélections évaluées (${mr.evaluatedPicks.length})`}
        rows={mr.evaluatedPicks}
        evaluated
      />
    </div>
  );
}
