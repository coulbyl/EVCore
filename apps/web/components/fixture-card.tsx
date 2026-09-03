import type { ReactNode } from "react";
import { cn } from "@evcore/ui";
import { FixtureCardHeader } from "@/components/fixture-card-header";
import { FixtureStatusBadge } from "@/components/fixture-status-badge";

/** Shared match card shell: bordered/rounded panel with a fixture header
 * band on top and arbitrary content below. */
export function FixtureCard({
  fixture,
  homeLogo,
  awayLogo,
  homeBadge,
  awayBadge,
  competition,
  country,
  kickoff,
  score,
  htScore,
  status,
  locale,
  headerExtra,
  beforeHeader,
  metaExtra,
  className,
  bodyClassName,
  children,
}: {
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  /** Rendered right after that team's name (e.g. a "new coach" chip). */
  homeBadge?: ReactNode;
  awayBadge?: ReactNode;
  competition: string | null;
  country: string | null;
  kickoff: string;
  score: string | null;
  htScore: string | null;
  /** Fixture status (SCHEDULED, IN_PROGRESS, POSTPONED, ...) — surfaced as a
   * badge only for states a kickoff time + score can't already convey. */
  status?: string;
  locale: string;
  headerExtra?: ReactNode;
  beforeHeader?: ReactNode;
  /** Extra info appended after the kickoff time in the header meta line. */
  metaExtra?: ReactNode;
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
      <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/60 bg-secondary/25 px-4 py-2.5">
        <FixtureCardHeader
          fixture={fixture}
          homeLogo={homeLogo}
          awayLogo={awayLogo}
          homeBadge={homeBadge}
          awayBadge={awayBadge}
          competition={competition}
          country={country}
          kickoff={kickoff}
          score={score}
          htScore={htScore}
          locale={locale}
          metaExtra={
            <>
              {status && <FixtureStatusBadge status={status} locale={locale} />}
              {metaExtra}
            </>
          }
        />
        {headerExtra}
      </div>
      <div className={cn("px-4", bodyClassName)}>{children}</div>
    </div>
  );
}
