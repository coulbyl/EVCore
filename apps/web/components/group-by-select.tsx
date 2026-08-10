"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@evcore/ui";

export type GroupByMode = "none" | "league";

// Dropdown, not tabs — same reasoning as Track Record's channel selector
// (apps/web/app/dashboard/track-record/components/channel-competition-section.tsx):
// ~35 competitions/day would overflow a tab strip on mobile.
export function GroupBySelect({
  value,
  onChange,
  labels,
  className,
}: {
  value: GroupByMode;
  onChange: (mode: GroupByMode) => void;
  labels: { none: string; league: string };
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as GroupByMode)}>
      <SelectTrigger className={className ?? "w-full sm:w-[190px]"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{labels.none}</SelectItem>
        <SelectItem value="league">{labels.league}</SelectItem>
      </SelectContent>
    </Select>
  );
}
