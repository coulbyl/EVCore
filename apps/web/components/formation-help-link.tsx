"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@evcore/ui";

// Contextual bridge to the relevant Formation article (doc perf-ux-audit
// §6.1, onboarding quick-win) — the content already exists, this is just
// the missing gateway at the point where a term/badge/number needs
// explaining, instead of a generic onboarding system.
export function FormationHelpLink({
  slug,
  label,
  tourId,
}: {
  slug: string;
  label: string;
  // Optional anchor for the onboarding tour (driver.js targets it via
  // `[data-tour="..."]`) — always rendered regardless of page data state,
  // which makes it a more robust tour target than a dynamic list item.
  tourId?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={`/dashboard/formation/${slug}`}
          aria-label={label}
          data-tour={tourId}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-panel-strong text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <HelpCircle size={16} />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
