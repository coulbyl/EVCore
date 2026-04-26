"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FilterBar, type FilterDef, type FilterState } from "@evcore/ui";
import { TIME_SLOTS } from "@/constants/time-slots";
import { COMPETITIONS } from "@/constants/competitions";
import {
  BET_STATUS_OPTIONS,
  DECISION_OPTIONS,
  STATUS_OPTIONS,
} from "@/domains/fixture/constants/filters";
import type { FixtureFilters } from "@/domains/fixture/types/fixture";

type Props = { filters: FixtureFilters };

const FILTER_DEFS: FilterDef[] = [
  {
    key: "date",
    label: "Date",
    type: "date",
  },
  {
    key: "competition",
    label: "Compétition",
    type: "select",
    options: [
      { value: "ALL", label: "Toutes" },
      ...COMPETITIONS.map((c) => ({ value: c.code, label: c.name })),
    ],
  },
  {
    key: "decision",
    label: "Décision",
    type: "select",
    options: DECISION_OPTIONS,
  },
  {
    key: "status",
    label: "Statut",
    type: "select",
    options: STATUS_OPTIONS,
  },
  {
    key: "timeSlot",
    label: "Horaire",
    type: "select",
    options: [
      { value: "ALL", label: "Tous horaires" },
      ...TIME_SLOTS.map((s) => ({
        value: s.key,
        label: `${s.label} ${s.start}h–${s.end}h`,
      })),
    ],
  },
  {
    key: "betStatus",
    label: "Résultat",
    type: "select",
    options: BET_STATUS_OPTIONS,
  },
];

function filtersToState(f: FixtureFilters): FilterState {
  return {
    date: f.date,
    competition: f.competition,
    decision: f.decision,
    status: f.status,
    timeSlot: f.timeSlot,
    betStatus: f.betStatus,
  };
}

export function FixturesFilters({ filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FilterState>(filtersToState(filters));

  useEffect(() => {
    setState(filtersToState(filters));
  }, [filters]);

  function handleChange(next: FilterState) {
    setState(next);
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", (next.date as string) ?? filters.date);
      params.set("competition", (next.competition as string) ?? "ALL");
      params.set("decision", (next.decision as string) ?? "ALL");
      params.set("status", (next.status as string) ?? "ALL");
      params.set("timeSlot", (next.timeSlot as string) ?? "ALL");
      params.set("betStatus", (next.betStatus as string) ?? "ALL");
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleReset() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("competition", "ALL");
    params.set("decision", "ALL");
    params.set("status", "ALL");
    params.set("timeSlot", "ALL");
    params.set("betStatus", "ALL");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div
      className={
        isPending
          ? "pointer-events-none opacity-60 transition-opacity"
          : "transition-opacity"
      }
    >
      <FilterBar
        filters={FILTER_DEFS}
        value={state}
        onChange={handleChange}
        onReset={handleReset}
      />
    </div>
  );
}
