"use client";

import { Bell } from "lucide-react";
import { Button } from "@evcore/ui";
import { usePushSubscription } from "@/domains/push/use-cases/use-push-subscription";

// Shown above the chat while notifications aren't set up yet — dismisses
// itself once subscribed (or if the browser/OS can't support it at all).
// Deliberately not shown for "denied": nothing we render can fix that short
// of sending the user into their browser's site settings.
export function PushNotificationBanner() {
  const { status, isBusy, error, enable } = usePushSubscription();

  if (status !== "available") return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-2.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bell size={14} className="shrink-0 text-accent" />
        <span>Active les notifications pour ne rater aucune réponse.</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {error && <span className="text-[0.65rem] text-danger">{error}</span>}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void enable()}
          disabled={isBusy}
        >
          {isBusy ? "…" : "Activer"}
        </Button>
      </div>
    </div>
  );
}
