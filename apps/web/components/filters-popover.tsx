"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@evcore/ui";
import { cn } from "@evcore/ui/cn";

// Collapses secondary filters (toggle, group-by, top-N…) behind one button
// instead of stacking each control on its own full-width row — the mobile
// header on Décisions/Investir used to be 4-5 rows of chrome before any
// content. `active` shows a small accent dot when a non-default filter is
// set, so collapsing them doesn't hide that state entirely.
export function FiltersPopover({
  label,
  active,
  children,
  className,
}: {
  label: string;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("relative h-9 shrink-0 gap-1.5 text-xs", className)}
        >
          <SlidersHorizontal size={13} />
          {label}
          {active && (
            <span className="absolute -right-1 -top-1 size-2 rounded-full bg-accent" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-64 flex-col gap-3">
        {children}
      </PopoverContent>
    </Popover>
  );
}
