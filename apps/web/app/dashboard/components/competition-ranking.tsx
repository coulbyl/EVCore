"use client";

import { Trophy } from "lucide-react";
import type { CompetitionStat } from "@/domains/dashboard/types/dashboard";

function RoiChip({ roi }: { roi: string | null }) {
  if (!roi) {
    return (
      <span className="text-[0.6rem] italic text-slate-400">données insuff.</span>
    );
  }
  const positive = roi.startsWith("+");
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums ${
        positive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-600"
      }`}
    >
      {roi}
    </span>
  );
}

function CompetitionRow({
  stat,
  index,
}: {
  stat: CompetitionStat;
  index: number;
}) {
  const pos = String(index + 1).padStart(2, "0");
  return (
    <div className="group rounded-xl px-2.5 py-2.5 transition-colors hover:bg-slate-50">
      {/* Ligne 1 : index + code + nom + nb matchs */}
      <div className="flex items-center gap-2.5">
        <span className="w-5 shrink-0 text-center text-[0.6rem] font-bold tabular-nums text-slate-400">
          {pos}
        </span>
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[0.53rem] font-extrabold uppercase tracking-[0.14em] text-slate-500">
          {stat.competitionCode}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.78rem] font-semibold text-slate-700 transition-colors group-hover:text-slate-900">
          {stat.competitionName}
        </span>
        <span className="shrink-0 text-[0.6rem] text-slate-400">
          {stat.activeFixtures} match{stat.activeFixtures > 1 ? "s" : ""}
        </span>
      </div>

      {/* Ligne 2 : stats moteur */}
      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-7">
        <span className="text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Moteur
        </span>
        <RoiChip roi={stat.model.roi} />
        {stat.model.winRate && (
          <span className="text-[0.6rem] text-slate-500">
            {stat.model.winRate} victoires
          </span>
        )}
        <span className="text-[0.58rem] text-slate-400">
          ({stat.model.settled} joués)
        </span>
      </div>

      {/* Ligne 3 : mes picks (si présents) */}
      {stat.myPicks && (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 pl-7">
          <span className="text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-violet-500">
            Mes paris
          </span>
          <RoiChip roi={stat.myPicks.roi} />
          <span className="text-[0.58rem] text-slate-400">
            ({stat.myPicks.settled} joués)
          </span>
        </div>
      )}
    </div>
  );
}

export function CompetitionRanking({ stats }: { stats: CompetitionStat[] }) {
  return (
    <div className="flex flex-col rounded-[1.35rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={14} className="shrink-0 text-amber-500" />
        <h2 className="text-sm font-bold tracking-tight text-slate-800">
          Classement ligues
        </h2>
        <span className="ml-auto text-[0.6rem] font-medium uppercase tracking-wide text-slate-400">
          30j · ROI moteur
        </span>
      </div>

      {/* List */}
      {stats.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Aucune donnée sur 30 jours.
        </p>
      ) : (
        <div
          className="max-h-65 overflow-y-auto"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
        >
          <div className="space-y-0.5">
            {stats.map((stat, i) => (
              <CompetitionRow key={stat.competitionId} stat={stat} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
