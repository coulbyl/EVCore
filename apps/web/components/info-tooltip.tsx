"use client";

import * as HoverCard from "@radix-ui/react-hover-card";
import { Info } from "lucide-react";

type InfoTooltipProps = {
  label: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
};

export function InfoTooltip({ label, description, side = "right" }: InfoTooltipProps) {
  return (
    <HoverCard.Root openDelay={200} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <button
          type="button"
          className="flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
          aria-label={`En savoir plus sur ${label}`}
        >
          <Info size={11} strokeWidth={2} />
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side={side}
          align="start"
          sideOffset={8}
          className="z-50 w-64 rounded-2xl border border-border bg-white p-4 shadow-lg"
        >
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {label}
          </p>
          <p className="text-sm leading-6 text-slate-700">{description}</p>
          <HoverCard.Arrow className="fill-white" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
