import Link from "next/link";
import { cn } from "@evcore/ui/lib/utils";
import { PERIODS, type PeriodKey } from "../track-record-constants";

export function PeriodTabs({ active }: { active: PeriodKey }) {
  return (
    <nav
      aria-label="Période"
      className="inline-flex gap-1 rounded-full border border-border bg-panel p-1"
    >
      {PERIODS.map((period) => (
        <Link
          key={period.key}
          href={`/track-record?period=${period.key}`}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            period.key === active
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {period.label}
        </Link>
      ))}
    </nav>
  );
}
