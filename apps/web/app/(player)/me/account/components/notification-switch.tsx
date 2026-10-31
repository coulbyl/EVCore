"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { playerFetch } from "@/lib/api/player-fetch";

/**
 * One of the notification switches (09 § 5): what is sent, not what it
 * says. Changed at once on screen, put back if the server refuses.
 */
export function NotificationSwitch({
  field,
  label,
  hint,
  initial,
}: {
  field: string;
  label: string;
  hint: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);

  async function toggle() {
    const next = !on;
    setOn(next);
    try {
      await playerFetch("/auth/me", {
        method: "PATCH",
        body: { [field]: next },
      });
    } catch {
      setOn(!next);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      className="flex min-h-12 w-full items-center gap-3 text-start focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body">{label}</span>
        {hint ? (
          <span className="text-meta text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={clsx(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          on ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={clsx(
            "absolute top-1 size-5 rounded-full bg-card shadow-sm transition-[inset-inline-start]",
            on ? "start-6" : "start-1",
          )}
        />
      </span>
    </button>
  );
}
