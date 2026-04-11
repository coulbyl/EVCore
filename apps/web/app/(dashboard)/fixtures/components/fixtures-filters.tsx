"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { TIME_SLOTS } from "@/constants/time-slots";
import { COMPETITIONS } from "@/constants/competitions";
import { DECISION_OPTIONS, STATUS_OPTIONS } from "@/domains/fixture/constants/filters";
import type { FixtureFilters } from "@/domains/fixture/types/fixture";

type Props = { filters: FixtureFilters };

export function FixturesFilters({ filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams],
  );

  return (
    <div
      className={`space-y-3 transition-opacity ${isPending ? "opacity-60 pointer-events-none" : ""}`}
    >
      {/* Ligne 1 : date + compétition */}
      <div className="flex flex-wrap items-end gap-2">
        {/* Date */}
        <label className="flex flex-col gap-1">
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Date
          </span>
          <input
            type="date"
            value={filters.date}
            onChange={(e) => update("date", e.target.value)}
            className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-medium text-slate-700 shadow-sm"
          />
        </label>

        {/* Compétition */}
        <label className="flex flex-col gap-1">
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Compétition
          </span>
          <select
            value={filters.competition}
            onChange={(e) => update("competition", e.target.value)}
            className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-medium text-slate-700 shadow-sm"
          >
            <option value="ALL">Toutes</option>
            {COMPETITIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Ligne 2 : pills décision + statut — scroll horizontal sur mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {/* Décision */}
        <div className="flex shrink-0 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          {DECISION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update("decision", opt.value)}
              className={`h-11 px-4 text-sm font-semibold transition-colors ${
                filters.decision === opt.value
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Séparateur visuel */}
        <div className="w-px shrink-0 self-stretch bg-border" />

        {/* Statut */}
        <div className="flex shrink-0 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update("status", opt.value)}
              className={`h-11 px-4 text-sm font-semibold transition-colors ${
                filters.status === opt.value
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ligne 3 : créneaux horaires — scroll horizontal sur mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => update("timeSlot", "ALL")}
          className={`h-10 shrink-0 rounded-full px-4 text-xs font-semibold transition-colors ${
            filters.timeSlot === "ALL"
              ? "bg-slate-900 text-white"
              : "border border-border bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Tous horaires
        </button>
        {TIME_SLOTS.map((slot) => (
          <button
            key={slot.key}
            type="button"
            onClick={() => update("timeSlot", slot.key)}
            className={`h-10 shrink-0 rounded-full px-4 text-xs font-semibold transition-colors ${
              filters.timeSlot === slot.key
                ? "bg-slate-900 text-white"
                : "border border-border bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {slot.label}
            <span className="ml-1 opacity-60">
              {slot.start}h–{slot.end}h
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
