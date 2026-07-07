import type { ReactNode } from "react";
import { cn } from "@evcore/ui";
import { FixtureCardHeader } from "@/components/fixture-card-header";

/** Shared match card shell: bordered/rounded panel with a fixture header
 * band on top and arbitrary content below. Used by Investment and decisions
 * to keep both pages visually consistent. */
export function FixtureCard({
  fixture,
  homeLogo,
  awayLogo,
  competition,
  country,
  kickoff,
  score,
  htScore,
  locale,
  headerExtra,
  beforeHeader,
  className,
  bodyClassName,
  children,
}: {
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string | null;
  country: string | null;
  kickoff: string;
  score: string | null;
  htScore: string | null;
  locale: string;
  headerExtra?: ReactNode;
  beforeHeader?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-panel shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      {beforeHeader}
      <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-secondary/25 px-4 py-2.5">
        <FixtureCardHeader
          fixture={fixture}
          homeLogo={homeLogo}
          awayLogo={awayLogo}
          competition={competition}
          country={country}
          kickoff={kickoff}
          score={score}
          htScore={htScore}
          locale={locale}
        />
        {headerExtra}
      </div>
      <div className={cn("px-4", bodyClassName)}>{children}</div>
    </div>
  );
}
