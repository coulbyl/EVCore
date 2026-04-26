"use client";

import { CalendarDays } from "lucide-react";
import { cn } from "@evcore/ui";

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function DateField({
  label,
  value,
  onChange,
  className,
}: DateFieldProps) {
  return (
    <label
      className={cn(
        "relative rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground",
        className,
      )}
    >
      <span className="mb-0.5 block text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ev-date-input w-full min-w-0 appearance-none bg-transparent pr-8 text-foreground outline-none"
      />
      <CalendarDays
        size={16}
        className="pointer-events-none absolute bottom-3 right-3 text-muted-foreground"
      />
    </label>
  );
}
