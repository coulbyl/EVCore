"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRIMARY, QUIET } from "@/components/scoreboard/ui/form-looks";
import { playerFetch } from "@/lib/api/player-fetch";

/**
 * « Passes planifiées » (12-admin.md § 4): for an incident only. Cutting
 * asks for confirmation; switching back on does not. The home shows the
 * red banner as long as they are off.
 */
export function SchedulingSwitch({
  on,
  label,
  detail,
  labels,
}: {
  on: boolean;
  label: string;
  detail: string;
  labels: {
    confirmTitle: string;
    confirmBody: string;
    confirm: string;
    cancel: string;
    failed: string;
  };
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const popover = "scheduling-off";

  async function write(value: boolean) {
    setState("busy");
    try {
      await playerFetch("/console/settings/scheduling.enabled", {
        method: "PUT",
        body: { value },
      });
      setState("idle");
      document.getElementById(popover)?.hidePopover();
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  const track = on ? "bg-led-on" : "bg-muted";
  const knob = on ? "translate-x-[1.125rem] bg-band" : "bg-card";

  return (
    <div className="flex min-h-13 items-center gap-3 py-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body font-medium">{label}</span>
        <span className="text-meta text-muted-foreground">{detail}</span>
        {state === "failed" ? (
          <span role="alert" className="text-meta text-loss">
            {labels.failed}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={state === "busy"}
        popoverTarget={on ? popover : undefined}
        onClick={on ? undefined : () => void write(true)}
        className={`relative h-[1.625rem] w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 ${track}`}
      >
        <span
          aria-hidden
          className={`absolute top-[3px] left-[3px] size-5 rounded-full shadow-sm transition-transform ${knob}`}
        />
      </button>
      <div
        id={popover}
        popover="auto"
        role="alertdialog"
        aria-label={labels.confirmTitle}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-[0.875rem] border border-border bg-card p-4 text-card-foreground shadow-lg backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-3">
          <p className="text-bet font-semibold">{labels.confirmTitle}</p>
          <p className="text-body">{labels.confirmBody}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={state === "busy"}
              onClick={() => void write(false)}
              className={`${PRIMARY} flex-1`}
            >
              {labels.confirm}
            </button>
            <button
              type="button"
              popoverTarget={popover}
              popoverTargetAction="hide"
              className={QUIET}
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
