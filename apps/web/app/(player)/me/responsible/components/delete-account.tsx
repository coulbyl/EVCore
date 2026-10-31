"use client";

import { useState } from "react";
import { playerFetch } from "@/lib/api/player-fetch";
import { clearScreensCache } from "@/components/scoreboard/states/screens-cache";

/**
 * « Supprimer mon compte » (09 § 4): here rather than in Compte, an act of
 * responsible gambling before a setting. The password, then at once, no
 * grace period (shipped on 2026-10-28); the server clears the session.
 * In ink, not red: red speaks of results only.
 */
export function DeleteAccount({
  labels,
}: {
  labels: { password: string; confirm: string; failed: string };
}) {
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function remove(event: React.FormEvent) {
    event.preventDefault();
    if (!password) return;
    setState("busy");
    try {
      await playerFetch("/auth/me/delete", {
        method: "POST",
        body: { password },
      });
      await clearScreensCache();
      window.location.assign("/");
    } catch {
      setState("failed");
    }
  }

  return (
    <form onSubmit={remove} className="flex flex-col gap-2 pt-2">
      <label className="flex flex-col gap-1 text-meta text-muted-foreground">
        {labels.password}
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-12 rounded-[0.625rem] border border-border bg-card px-3 text-body text-foreground focus:outline-2 focus:outline-ring"
        />
      </label>
      <button
        type="submit"
        disabled={state === "busy" || !password}
        className="min-h-12 rounded-[0.625rem] bg-foreground px-4 text-body font-medium text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
      >
        {labels.confirm}
      </button>
      {state === "failed" ? (
        <p role="alert" className="text-meta">
          {labels.failed}
        </p>
      ) : null}
    </form>
  );
}
