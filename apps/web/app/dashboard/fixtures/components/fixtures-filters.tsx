"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { TIME_SLOTS } from "@/constants/time-slots";
import { COMPETITIONS } from "@/constants/competitions";
import { Button } from "@evcore/ui";
import {
  BET_STATUS_OPTIONS,
  DECISION_OPTIONS,
  STATUS_OPTIONS,
} from "@/domains/fixture/constants/filters";
import type { FixtureFilters } from "@/domains/fixture/types/fixture";

type Props = { filters: FixtureFilters };

export function FixturesFilters({ filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FixtureFilters>(filters);

  useEffect(() => {
    setForm(filters);
  }, [filters]);

  const timeSlotOptions = useMemo(
    () => [
      { value: "ALL", label: "Tous horaires" },
      ...TIME_SLOTS.map((slot) => ({
        value: slot.key,
        label: `${slot.label} ${slot.start}h–${slot.end}h`,
      })),
    ],
    [],
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", form.date);
      params.set("competition", form.competition);
      params.set("decision", form.decision);
      params.set("status", form.status);
      params.set("timeSlot", form.timeSlot);
      params.set("betStatus", form.betStatus);
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const labelCls =
    "text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-400";
  const inputCls =
    "h-11 cursor-pointer rounded-xl border border-border bg-white px-3 text-sm font-medium text-slate-700 shadow-sm";

  return (
    <form
      onSubmit={handleSubmit}
      className={`transition-opacity ${isPending ? "opacity-60 pointer-events-none" : ""}`}
    >
      {/* Mobile : grille 2 colonnes */}
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        <label className="col-span-2 flex flex-col gap-1">
          <span className={labelCls}>Date</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, date: e.target.value }))
            }
            className={inputCls}
          />
        </label>

        <label className="col-span-2 flex flex-col gap-1">
          <span className={labelCls}>Compétition</span>
          <select
            value={form.competition}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, competition: e.target.value }))
            }
            className={inputCls}
          >
            <option value="ALL">Toutes</option>
            {COMPETITIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>Décision</span>
          <select
            value={form.decision}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                decision: e.target.value as FixtureFilters["decision"],
              }))
            }
            className={inputCls}
          >
            {DECISION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>Statut</span>
          <select
            value={form.status}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                status: e.target.value as FixtureFilters["status"],
              }))
            }
            className={inputCls}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>Horaire</span>
          <select
            value={form.timeSlot}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                timeSlot: e.target.value as FixtureFilters["timeSlot"],
              }))
            }
            className={inputCls}
          >
            {timeSlotOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>Résultat</span>
          <select
            value={form.betStatus}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                betStatus: e.target.value as FixtureFilters["betStatus"],
              }))
            }
            className={inputCls}
          >
            {BET_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <Button
          type="submit"
          className="col-span-2 mt-1 h-11 w-full rounded-xl"
        >
          {isPending ? "Filtrage..." : "Filtrer"}
        </Button>
      </div>

      {/* Desktop : une ligne */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-[180px_220px_160px_160px_160px_220px_auto]">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Date</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, date: e.target.value }))
            }
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>Compétition</span>
          <select
            value={form.competition}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, competition: e.target.value }))
            }
            className={inputCls}
          >
            <option value="ALL">Toutes</option>
            {COMPETITIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>Décision</span>
          <select
            value={form.decision}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                decision: e.target.value as FixtureFilters["decision"],
              }))
            }
            className={inputCls}
          >
            {DECISION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>Statut</span>
          <select
            value={form.status}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                status: e.target.value as FixtureFilters["status"],
              }))
            }
            className={inputCls}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>Horaire</span>
          <select
            value={form.timeSlot}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                timeSlot: e.target.value as FixtureFilters["timeSlot"],
              }))
            }
            className={inputCls}
          >
            {timeSlotOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>Résultat</span>
          <select
            value={form.betStatus}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                betStatus: e.target.value as FixtureFilters["betStatus"],
              }))
            }
            className={inputCls}
          >
            {BET_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <Button type="submit" className="h-11 w-full rounded-xl lg:w-auto">
            {isPending ? "Filtrage..." : "Filtrer"}
          </Button>
        </div>
      </div>
    </form>
  );
}
