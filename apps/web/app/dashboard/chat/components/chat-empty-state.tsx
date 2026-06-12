"use client";

import { Sparkles } from "lucide-react";
import { SUGGESTION_CHIPS } from "./chat-constants";

export function ChatEmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent/12">
          <Sparkles className="size-6 text-accent" />
        </span>
        <h1 className="text-xl font-semibold">EVA — Expected Value Analyst</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Je réponds sur les picks, coupons et performances du moteur EVCore.
          Pose ta question, ou commence par une suggestion.
        </p>
      </div>

      <div className="flex max-w-xl flex-wrap justify-center gap-2">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => onPick(chip)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
