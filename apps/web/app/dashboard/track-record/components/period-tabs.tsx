import Link from "next/link";
import { cn } from "@evcore/ui/lib/utils";
import { PERIODS, type PeriodKey } from "../track-record-constants";

export function PeriodTabs({ active }: { active: PeriodKey }) {
  return (
    <nav
      aria-label="Période"
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-panel p-1"
    >
      {PERIODS.map((period) => (
        <Link
          key={period.key}
          href={`/dashboard/track-record?period=${period.key}`}
          aria-current={period.key === active ? "page" : undefined}
          className={cn(
            // 44 px de haut : cible au doigt sur téléphone.
            "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors sm:px-4",
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
