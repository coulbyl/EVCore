"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";

type Labels = {
  makeAdmin: string;
  makePlayer: string;
  suspend: string;
  unsuspend: string;
  resetLink: string;
  delete: string;
  deleteConfirm: string;
  confirm: string;
  cancel: string;
  failed: string;
  copied: string;
};

/**
 * A player's actions (12-admin.md § 3): role, suspension, a reset link to
 * pass on, deletion after a confirmation. The server journals each (G11).
 */
export function PlayerActions({
  id,
  role,
  suspended,
  labels,
}: {
  id: string;
  role: "ADMIN" | "OPERATOR";
  suspended: boolean;
  labels: Labels;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const [link, setLink] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setState("busy");
    try {
      await action();
      setState("idle");
      if (after) after();
      else router.refresh();
    } catch {
      setState("failed");
    }
  }

  const button =
    "min-h-11 rounded-full border border-border px-4 text-body font-medium hover:bg-muted disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const busy = state === "busy";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className={button}
          onClick={() =>
            void run(() =>
              playerFetch(`/admin/users/${id}`, {
                method: "PATCH",
                body: { role: role === "ADMIN" ? "OPERATOR" : "ADMIN" },
              }),
            )
          }
        >
          {role === "ADMIN" ? labels.makePlayer : labels.makeAdmin}
        </button>
        <button
          type="button"
          disabled={busy}
          className={button}
          onClick={() =>
            void run(() =>
              playerFetch(`/admin/users/${id}`, {
                method: "PATCH",
                body: { suspended: !suspended },
              }),
            )
          }
        >
          {suspended ? labels.unsuspend : labels.suspend}
        </button>
        <button
          type="button"
          disabled={busy}
          className={button}
          onClick={() =>
            void run(
              async () => {
                const res = await playerFetch<{ resetUrl: string }>(
                  `/admin/users/${id}/reset-password-link`,
                  { method: "POST" },
                );
                setLink(res?.resetUrl ?? null);
              },
              () => undefined,
            )
          }
        >
          {labels.resetLink}
        </button>
        {confirming ? null : (
          <button
            type="button"
            disabled={busy}
            className={`${button} text-loss`}
            onClick={() => setConfirming(true)}
          >
            {labels.delete}
          </button>
        )}
      </div>
      {confirming ? (
        <div
          role="alertdialog"
          className="flex flex-col gap-2 rounded-[0.875rem] border border-loss p-3"
        >
          <p className="text-body">{labels.deleteConfirm}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-full bg-loss px-4 text-body font-medium text-white disabled:opacity-50"
              onClick={() =>
                void run(
                  () => playerFetch(`/admin/users/${id}`, { method: "DELETE" }),
                  () => router.push("/admin/players"),
                )
              }
            >
              {labels.confirm}
            </button>
            <button
              type="button"
              className={button}
              onClick={() => setConfirming(false)}
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      ) : null}
      {link ? (
        <p className="text-meta">
          {labels.copied} <span className="break-all font-medium">{link}</span>
        </p>
      ) : null}
      {state === "failed" ? (
        <p role="alert" className="text-meta text-loss">
          {labels.failed}
        </p>
      ) : null}
    </div>
  );
}
