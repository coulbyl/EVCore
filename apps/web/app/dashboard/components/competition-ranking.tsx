"use client";

import { Trophy } from "lucide-react";
import type { CompetitionStat } from "@/domains/dashboard/types/dashboard";

function RoiChip({ roi }: { roi: string | null }) {
  if (!roi) {
    return (
      <span className="text-[0.65rem] text-slate-400 italic">
        données insuff.
      </span>
    );
  }
  const positive = roi.startsWith("+");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.68rem] font-bold tabular-nums ${
        positive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-600"
      }`}
    >
      {roi}
    </span>
  );
}

function CompetitionRow({ stat }: { stat: CompetitionStat }) {
  return (
    <div className="flex flex-col gap-2 rounded-[1rem] border border-slate-100 bg-white p-3 sm:p-4">
      {/* En-tête : nom + code + fixtures actives */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-slate-500">
            {stat.competitionCode}
          </span>
          <span className="truncate text-sm font-semibold text-slate-800">
            {stat.competitionName}
          </span>
        </div>
        <span className="shrink-0 text-[0.65rem] text-slate-400">
          {stat.activeFixtures} match{stat.activeFixtures > 1 ? "s" : ""}
        </span>
      </div>

      {/* Stats moteur */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[0.62rem] uppercase tracking-[0.12em] text-slate-400">
            Moteur
          </span>
          <RoiChip roi={stat.model.roi} />
          {stat.model.winRate && (
            <span className="text-[0.65rem] text-slate-500">
              {stat.model.winRate} victoires
            </span>
          )}
          <span className="text-[0.62rem] text-slate-400">
            ({stat.model.settled} settlés)
          </span>
        </div>
      </div>

      {/* Mes picks — uniquement si l'utilisateur a des picks dans cette ligue */}
      {stat.myPicks && (
        <div className="flex items-center gap-1.5 border-t border-slate-50 pt-2">
          <span className="text-[0.62rem] uppercase tracking-[0.12em] text-slate-400">
            Mes picks
          </span>
          <RoiChip roi={stat.myPicks.roi} />
          <span className="text-[0.62rem] text-slate-400">
            ({stat.myPicks.settled} settlés)
          </span>
        </div>
      )}
    </div>
  );
}

export function CompetitionRanking({ stats }: { stats: CompetitionStat[] }) {
  return (
    <div className="rounded-[1.35rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      <div className="mb-4 flex items-center gap-2">
        <Trophy size={15} className="text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-800">
          Compétitions actives
        </h2>
        <span className="ml-auto text-[0.65rem] text-slate-400">
          30 derniers jours
        </span>
      </div>

      {stats.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Aucune compétition avec des données sur 30 jours.
        </p>
      ) : (
        <div className="space-y-2">
          {stats.map((stat) => (
            <CompetitionRow key={stat.competitionId} stat={stat} />
          ))}
        </div>
      )}
    </div>
  );
}
