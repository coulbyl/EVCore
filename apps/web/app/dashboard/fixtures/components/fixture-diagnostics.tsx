"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { fixtureStatusBadgeClass, fixtureStatusLabel } from "@/helpers/fixture";
import type {
  FixtureEvaluatedPickSnapshot,
  FixturePickSnapshot,
  FixtureRow,
} from "@/domains/fixture/types/fixture";

function CopyFixtureId({ fixtureId }: { fixtureId: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(fixtureId).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title={fixtureId}
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.65rem] font-mono text-slate-400 hover:bg-slate-100 hover:text-slate-600"
    >
      <span>{fixtureId.slice(0, 8)}</span>
      {copied ? (
        <Check size={10} className="text-success" />
      ) : (
        <Copy size={10} />
      )}
    </button>
  );
}

function modelPickLabel(market: string, pick: string): string {
  if (market === "ONE_X_TWO") {
    if (pick === "HOME") return "V1";
    if (pick === "DRAW") return "N";
    if (pick === "AWAY") return "V2";
  }

  if (market === "BTTS") {
    if (pick === "YES") return "BB OUI";
    if (pick === "NO") return "BB NON";
  }

  if (market === "FIRST_HALF_WINNER") {
    if (pick === "HOME") return "MT DOMICILE";
    if (pick === "DRAW") return "MT NUL";
    if (pick === "AWAY") return "MT EXTÉRIEUR";
  }

  if (market === "OVER_UNDER" || market === "OVER_UNDER_25") {
    if (pick === "OVER") return "PLUS DE 2.5";
    if (pick === "UNDER") return "MOINS DE 2.5";
    if (pick === "OVER_1_5") return "PLUS DE 1.5";
    if (pick === "UNDER_1_5") return "MOINS DE 1.5";
    if (pick === "OVER_3_5") return "PLUS DE 3.5";
    if (pick === "UNDER_3_5") return "MOINS DE 3.5";
  }

  if (market === "OVER_UNDER_HT") {
    if (pick === "OVER_0_5") return "PLUS DE 0.5 MT";
    if (pick === "UNDER_0_5") return "MOINS DE 0.5 MT";
    if (pick === "OVER_1_5") return "PLUS DE 1.5 MT";
    if (pick === "UNDER_1_5") return "MOINS DE 1.5 MT";
  }

  if (market === "HALF_TIME_FULL_TIME") {
    return pick.replace(/_/g, " / ");
  }

  return pick.replace(/_/g, " ");
}

function combinedPickLabel(snapshot: FixturePickSnapshot): string {
  const primary = modelPickLabel(snapshot.market, snapshot.pick);
  if (!snapshot.comboMarket || !snapshot.comboPick) {
    return primary;
  }
  return `${primary} + ${modelPickLabel(snapshot.comboMarket, snapshot.comboPick)}`;
}

function rejectionReasonLabel(reason?: string): string {
  if (!reason) return "--";

  const labels: Record<string, string> = {
    odds_below_floor: "Cote trop basse",
    odds_above_cap: "Cote trop haute",
    ev_below_threshold: "EV insuffisant",
    ev_above_hard_cap: "EV au-dessus du plafond",
    ev_above_soft_cap: "EV au-dessus du plafond calibration",
    filtered_longshot: "Longshot filtré",
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
    <div>
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-[1.05rem] font-semibold text-slate-900">
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
              <th className="px-4 py-3 pr-4">Marché / Pick</th>
              <th className="px-4 py-3 pr-4">Prob.</th>
              <th className="px-4 py-3 pr-4">Cote</th>
              <th className="px-4 py-3 pr-4">EV</th>
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
                  <td className="px-4 py-3 pr-4 font-medium text-slate-800">
                    {combinedPickLabel(row)}
                  </td>
                  <td className="px-4 py-3 pr-4 tabular-nums text-slate-700">
                    {row.probability}
                  </td>
                  <td className="px-4 py-3 pr-4 tabular-nums text-slate-700">
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

  if (!mr) {
    return (
      <div className="rounded-[1.7rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
        <p className="text-sm text-slate-500">Aucun diagnostic disponible.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.35rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <p className="min-w-0 text-sm text-slate-600">
          {row.fixture}
          {mr.pick && mr.market ? (
            <>
              {" · "}
              <span className="font-semibold text-slate-800">
                {combinedPickLabel({
                  market: mr.market,
                  pick: mr.pick,
                  probability: "",
                  odds: "",
                  ev: "",
                  qualityScore: "",
                })}
              </span>
            </>
          ) : null}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${fixtureStatusBadgeClass(row.status)}`}
          >
            {fixtureStatusLabel(row.status)}
          </span>
          <CopyFixtureId fixtureId={row.fixtureId} />
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Entrées modèle
        </p>
        <div className="grid gap-3 rounded-[1.1rem] border border-slate-100 bg-slate-50 px-4 py-4 sm:grid-cols-4">
          <ModelInput label="Prob. estimée" value={mr.probEstimated} />
          <ModelInput label="λ V1" value={mr.lambdaHome} />
          <ModelInput label="λ V2" value={mr.lambdaAway} />
          <ModelInput label="Buts attendus" value={mr.expectedTotalGoals} />
        </div>
      </div>

      <DiagnosticTable
        title={`Picks candidats (${mr.candidatePicks.length})`}
        rows={mr.candidatePicks}
      />
      <DiagnosticTable
        title={`Picks évalués (${mr.evaluatedPicks.length})`}
        rows={mr.evaluatedPicks}
        evaluated
      />
    </div>
  );
}
