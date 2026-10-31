"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { playerFetch } from "@/lib/api/player-fetch";

type Duration = { days: number; label: string; endsAt: string };

/**
 * The break (09 § 4, the rule shipped on 2026-10-28): three lengths, a
 * one-line confirmation with the day of return, extendable, never
 * shortened — the server refuses a shorter one, and only the lengths that
 * extend a running break are offered.
 */
export function PauseChooser({
  durations,
  labels,
}: {
  /** With the end each would give, already written (« 5/11 à 19:00 »). */
  durations: readonly Duration[];
  labels: {
    group: string;
    /** With `{date}` for the day of return. */
    confirmLine: string;
    confirm: string;
    cancel: string;
    failed: string;
  };
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Duration | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function pause() {
    if (!chosen) return;
    setState("busy");
    try {
      await playerFetch("/auth/me/pause", {
        method: "POST",
        body: { days: chosen.days },
      });
      setChosen(null);
      setState("idle");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  const button =
    "min-h-12 flex-1 rounded-[0.625rem] border px-3 text-body font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={labels.group} className="flex gap-2">
        {durations.map((duration) => (
          <button
            key={duration.days}
            type="button"
            aria-pressed={chosen?.days === duration.days}
            onClick={() => {
              setChosen(duration);
              setState("idle");
            }}
            className={clsx(
              button,
              chosen?.days === duration.days
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card",
            )}
          >
            {duration.label}
          </button>
        ))}
      </div>
      {chosen ? (
        <div className="flex flex-col gap-2 rounded-[0.875rem] border border-border bg-card p-3">
          <p className="text-body">
            {labels.confirmLine.replace("{date}", chosen.endsAt)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={pause}
              disabled={state === "busy"}
              className={clsx(
                button,
                "border-primary bg-primary text-primary-foreground disabled:opacity-60",
              )}
            >
              {labels.confirm}
            </button>
            <button
              type="button"
              onClick={() => setChosen(null)}
              className={clsx(button, "border-border")}
            >
              {labels.cancel}
            </button>
          </div>
          {state === "failed" ? (
            <p role="alert" className="text-meta">
              {labels.failed}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
