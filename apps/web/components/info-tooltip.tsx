"use client";

import * as HoverCard from "@radix-ui/react-hover-card";
import { Info } from "lucide-react";
import { useState } from "react";

type InfoTooltipProps = {
  label: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
};

export function InfoTooltip({
  label,
  description,
  side = "right",
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <HoverCard.Root
      open={open}
      onOpenChange={setOpen}
      openDelay={200}
      closeDelay={100}
    >
      <HoverCard.Trigger asChild>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center text-muted-foreground hover:text-foreground focus:outline-none"
          aria-label={`En savoir plus sur ${label}`}
        >
          <Info size={12} strokeWidth={2} />
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side={side}
          align="start"
          sideOffset={8}
          onEscapeKeyDown={() => setOpen(false)}
          onPointerDownOutside={() => setOpen(false)}
          className="z-50 w-64 rounded-2xl border border-border bg-panel p-4 shadow-lg"
        >
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <p className="text-sm text-foreground">{description}</p>
          <HoverCard.Arrow className="fill-panel" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
