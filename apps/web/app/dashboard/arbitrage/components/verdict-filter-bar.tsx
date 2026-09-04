"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger, cn } from "@evcore/ui";
import type { ArbitrageFilter } from "./arbitrage-constants";

/** Verdict filter (Toutes/Recommandé/À éviter) — single-select, one
 * popover-picker button at every breakpoint, same pattern as
 * LeagueFilterBar/ChannelFilterBar on Decisions. Only 3 fixed options, so no
 * search input (unlike those two, which list a variable, sometimes long set
 * of leagues/channels). */
export function VerdictFilterBar({
  value,
  onSelect,
  options,
  label,
}: {
  value: ArbitrageFilter;
  onSelect: (value: ArbitrageFilter) => void;
  options: { value: ArbitrageFilter; label: string }[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-panel-strong px-4 py-2.5 text-sm font-medium text-foreground md:w-auto"
        >
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 text-muted-foreground">{label}</span>
            <span className="min-w-0 truncate">{selected?.label}</span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="flex flex-col gap-0.5">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onSelect(option.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm",
                option.value === value
                  ? "bg-accent-soft text-accent"
                  : "text-foreground hover:bg-secondary",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
