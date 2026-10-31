"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";

/**
 * « Réactiver » (12-admin.md § 2, § 5): a human decision, confirmed, with
 * its reason, journaled by the server. A native popover holds the form.
 */
export function ReactivateMarket({
  id,
  labels,
}: {
  id: string;
  labels: {
    action: string;
    title: string;
    reason: string;
    confirm: string;
    cancel: string;
    failed: string;
  };
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const popover = `reactivate-${id}`;

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setState("busy");
    try {
      await playerFetch(`/console/engine/suspensions/${id}/reactivate`, {
        method: "POST",
        body: { reason },
      });
      setState("idle");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  return (
    <>
      <button
        type="button"
        popoverTarget={popover}
        className="min-h-10 rounded-full border border-border px-3 text-meta font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {labels.action}
      </button>
      <div
        id={popover}
        popover="auto"
        role="dialog"
        aria-label={labels.title}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-[0.875rem] border border-border bg-card p-4 text-card-foreground shadow-lg backdrop:bg-black/40"
      >
        <form onSubmit={(e) => void confirm(e)} className="flex flex-col gap-3">
          <p className="text-bet font-semibold">{labels.title}</p>
          <label className="flex flex-col gap-1 text-meta text-muted-foreground">
            {labels.reason}
            <textarea
              required
              minLength={3}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-20 rounded-[0.625rem] border border-border bg-background px-3 py-2 text-body text-foreground"
            />
          </label>
          {state === "failed" ? (
            <p role="alert" className="text-meta text-loss">
              {labels.failed}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={state === "busy" || reason.trim().length < 3}
              className="h-11 flex-1 rounded-[0.625rem] bg-primary text-body font-medium text-primary-foreground disabled:opacity-50"
            >
              {labels.confirm}
            </button>
            <button
              type="button"
              popoverTarget={popover}
              popoverTargetAction="hide"
              className="h-11 rounded-[0.625rem] px-4 text-body"
            >
              {labels.cancel}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
