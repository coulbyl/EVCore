"use client";

import { Target } from "lucide-react";
import {
  usePredictions,
  usePredictionStats,
} from "@/domains/dashboard/use-cases/get-predictions";

const PICK_LABEL: Record<string, string> = {
  HOME: "Domicile",
  AWAY: "Extérieur",
  DRAW: "Nul",
};

function PredictionResultDot({ correct }: { correct: boolean | null }) {
  if (correct === true)
    return <span className="size-2 rounded-full bg-emerald-500" />;
  if (correct === false)
    return <span className="size-2 rounded-full bg-rose-500" />;
  return <span className="size-2 rounded-full bg-slate-300" />;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIso() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function PredictionsCard() {
  const today = todayIso();
  const yesterday = yesterdayIso();

  const { data: predictions = [] } = usePredictions(today);
  const { data: yesterdayStats } = usePredictionStats(yesterday, yesterday);

  const settled = predictions.filter((p) => p.correct !== null);
  const correct = settled.filter((p) => p.correct === true).length;

  const yesterdayLabel =
    yesterdayStats && yesterdayStats.total > 0
      ? `${yesterdayStats.correct}/${yesterdayStats.total} hier`
      : null;

  return (
    <div className="flex flex-col rounded-[1.35rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Target size={14} className="shrink-0 text-indigo-500" />
        <h2 className="text-sm font-bold tracking-tight text-slate-800">
          Prédictions du jour
        </h2>
        <div className="ml-auto flex items-center gap-2">
          {settled.length > 0 && (
            <span className="text-[0.6rem] font-semibold tabular-nums text-slate-500">
              {correct}/{settled.length} ✓
            </span>
          )}
          {yesterdayLabel && (
            <span className="text-[0.6rem] text-slate-400">
              {yesterdayLabel}
            </span>
          )}
          <span className="text-[0.6rem] font-medium uppercase tracking-wide text-slate-400">
            {predictions.length} match{predictions.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* List */}
      {predictions.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Aucune prédiction pour aujourd&apos;hui.
        </p>
      ) : (
        <div
          className="max-h-64 overflow-y-auto"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#cbd5e1 transparent",
          }}
        >
          <div className="space-y-0.5">
            {predictions.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-slate-50"
              >
                <PredictionResultDot correct={p.correct} />
                <span className="min-w-0 flex-1 truncate text-[0.78rem] font-semibold text-slate-700">
                  {p.fixture}
                </span>
                <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-indigo-600">
                  {PICK_LABEL[p.pick] ?? p.pick}
                </span>
                <span className="shrink-0 text-[0.72rem] font-semibold tabular-nums text-indigo-500">
                  {p.probability}
                </span>
                <span className="shrink-0 text-[0.6rem] text-slate-400">
                  {p.kickoff}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
