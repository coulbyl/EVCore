"use client";

import { useState } from "react";
import { playerFetch } from "@/lib/api/player-fetch";
import { clearScreensCache } from "@/components/scoreboard/states/screens-cache";

/**
 * « Se déconnecter », light, at the bottom of Moi (09 § 1). The server
 * closes the session and clears its cookie; then a full load of the
 * sign-in page, so nothing of the session stays in memory.
 */
export function SignOutButton({
  labels,
}: {
  labels: { signOut: string; failed: string };
}) {
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function signOut() {
    setState("busy");
    try {
      await playerFetch("/auth/logout", { method: "POST" });
      await clearScreensCache();
      window.location.assign("/auth/login");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={signOut}
        disabled={state === "busy"}
        className="min-h-11 rounded-md px-2 text-body text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
      >
        {labels.signOut}
      </button>
      {state === "failed" ? (
        <p role="alert" className="text-meta">
          {labels.failed}
        </p>
      ) : null}
    </div>
  );
}
