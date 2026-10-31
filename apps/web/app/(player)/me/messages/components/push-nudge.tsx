"use client";

import { Bell } from "lucide-react";
import { usePushSubscription } from "@/domains/push/use-cases/use-push-subscription";

/**
 * « Active les notifications pour ne rater aucune réponse » over the
 * thread, the one place a player waits for someone (taken from the old
 * inbox). Only while this device can still be asked: gone once subscribed,
 * never for a refusal (only the browser's settings can undo it) nor where
 * push does not exist.
 */
export function PushNudge({
  labels,
}: {
  labels: { text: string; enable: string };
}) {
  const { status, isBusy, error, enable } = usePushSubscription();
  // « default » is the hook's state before it has looked: no flash.
  if (status !== "available") return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 lg:px-6">
      <p className="flex items-center gap-2 text-meta text-muted-foreground">
        <Bell aria-hidden className="size-4 shrink-0" strokeWidth={2} />
        {error ?? labels.text}
      </p>
      <button
        type="button"
        onClick={() => void enable()}
        disabled={isBusy}
        className="min-h-11 shrink-0 rounded-full border border-border px-4 text-body font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
      >
        {isBusy ? "…" : labels.enable}
      </button>
    </div>
  );
}
