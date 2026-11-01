"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { PRIMARY, QUIET } from "@/components/scoreboard/ui/form-looks";
import { playerFetch } from "@/lib/api/player-fetch";

const ICON =
  "flex size-11 shrink-0 items-center justify-center rounded-[0.625rem] border border-border bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50";

/**
 * An announcement's actions, as icons: Modifier, Publier or Dépublier,
 * Supprimer after a confirmation. Publishing a draft notifies the players;
 * the server journals each.
 */
export function AnnouncementActions({
  id,
  published,
  labels,
}: {
  id: string;
  published: boolean;
  labels: {
    edit: string;
    publish: string;
    unpublish: string;
    remove: string;
    removeQuestion: string;
    confirm: string;
    cancel: string;
    failed: string;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const confirmId = `remove-announcement-${id}`;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      document.getElementById(confirmId)?.hidePopover();
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex gap-1.5">
        <Link
          href={`/admin/players/announcements?edit=${id}`}
          aria-label={labels.edit}
          title={labels.edit}
          className={ICON}
        >
          <Pencil aria-hidden className="size-[1.125rem]" strokeWidth={2} />
        </Link>
        <button
          type="button"
          disabled={busy}
          aria-label={published ? labels.unpublish : labels.publish}
          title={published ? labels.unpublish : labels.publish}
          onClick={() =>
            void run(() =>
              playerFetch(`/admin/announcements/${id}`, {
                method: "PATCH",
                body: { published: !published },
              }),
            )
          }
          className={ICON}
        >
          {published ? (
            <EyeOff aria-hidden className="size-[1.125rem]" strokeWidth={2} />
          ) : (
            <Eye aria-hidden className="size-[1.125rem]" strokeWidth={2} />
          )}
        </button>
        <button
          type="button"
          disabled={busy}
          popoverTarget={confirmId}
          aria-label={labels.remove}
          title={labels.remove}
          className={ICON}
        >
          <Trash2
            aria-hidden
            className="size-[1.125rem] text-loss"
            strokeWidth={2}
          />
        </button>
      </span>
      {failed ? (
        <span role="alert" className="text-legal text-loss">
          {labels.failed}
        </span>
      ) : null}
      <div
        id={confirmId}
        popover="auto"
        role="alertdialog"
        aria-label={labels.removeQuestion}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-[1rem] border border-border bg-card p-4 text-card-foreground shadow-lg backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-3">
          <p className="text-bet font-semibold">{labels.removeQuestion}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  playerFetch(`/admin/announcements/${id}`, {
                    method: "DELETE",
                  }),
                )
              }
              className={`${PRIMARY} flex-1`}
            >
              {labels.confirm}
            </button>
            <button
              type="button"
              popoverTarget={confirmId}
              popoverTargetAction="hide"
              className={QUIET}
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      </div>
    </span>
  );
}
