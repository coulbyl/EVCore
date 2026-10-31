"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";

/**
 * « Relancer » a pass (12-admin.md § 1): the same job as the schedule. The
 * server refuses it while the pass runs; the list is read again after.
 */
export function RelaunchButton({
  passKey,
  labels,
}: {
  passKey: string;
  labels: { relaunch: string; failed: string };
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function relaunch() {
    setState("busy");
    try {
      await playerFetch(`/console/passes/${passKey}/relaunch`, {
        method: "POST",
      });
      setState("idle");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  return (
    <span className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={() => void relaunch()}
        disabled={state === "busy"}
        className="min-h-10 rounded-full border border-border px-3 text-meta font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
      >
        {labels.relaunch}
      </button>
      {state === "failed" ? (
        <span role="alert" className="text-legal text-loss">
          {labels.failed}
        </span>
      ) : null}
    </span>
  );
}
