"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";

/**
 * « Retirer » a published announcement: it leaves the players' bell. A
 * mistaken announcement is not deleted, only unpublished, after a
 * confirmation in a native popover.
 */
export function WithdrawAnnouncement({
  id,
  labels,
}: {
  id: string;
  labels: {
    action: string;
    confirm: string;
    question: string;
    cancel: string;
    failed: string;
  };
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const popover = `withdraw-${id}`;

  async function withdraw() {
    setState("busy");
    try {
      await playerFetch(`/admin/announcements/${id}`, {
        method: "PATCH",
        body: { published: false },
      });
      setState("idle");
      document.getElementById(popover)?.hidePopover();
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
        className="min-h-10 self-start rounded-full border border-border px-3 text-meta font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {labels.action}
      </button>
      <div
        id={popover}
        popover="auto"
        role="alertdialog"
        aria-label={labels.question}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-[0.875rem] border border-border bg-card p-4 text-card-foreground shadow-lg backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-3">
          <p className="text-bet font-semibold">{labels.question}</p>
          {state === "failed" ? (
            <p role="alert" className="text-meta text-loss">
              {labels.failed}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={state === "busy"}
              onClick={() => void withdraw()}
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
        </div>
      </div>
    </>
  );
}
