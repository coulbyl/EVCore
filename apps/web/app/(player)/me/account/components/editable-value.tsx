"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";
import {
  FIELD,
  LINK,
  PRIMARY,
  QUIET,
} from "@/components/scoreboard/ui/form-looks";

/**
 * A profile value with « modifier » (09 § 5): the first name, the phone.
 * Saved on the server, then the page read again.
 */
export function EditableValue({
  value,
  emptyText,
  caption,
  path,
  field,
  inputType = "text",
  labels,
}: {
  value: string | null;
  emptyText?: string;
  /** « prénom », « téléphone ». */
  caption: string;
  path: "/auth/me" | "/auth/me/identity";
  field: string;
  inputType?: "text" | "tel";
  labels: { edit: string; save: string; cancel: string; failed: string };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setState("busy");
    try {
      await playerFetch(path, {
        method: "PATCH",
        body: { [field]: draft.trim() },
      });
      setEditing(false);
      setState("idle");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  if (!editing) {
    return (
      <div className="flex min-h-12 items-center justify-between gap-3">
        <p className="flex flex-col">
          <span className="text-body font-medium">{value ?? emptyText}</span>
          <span className="text-meta text-muted-foreground">{caption}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            setDraft(value ?? "");
            setEditing(true);
          }}
          aria-label={`${labels.edit} : ${caption}`}
          className={LINK}
        >
          {labels.edit}
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-2 py-1">
      <label className="flex flex-col gap-1 text-meta text-muted-foreground">
        {caption}
        <input
          type={inputType}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          required
          maxLength={50}
          autoComplete={inputType === "tel" ? "tel" : "given-name"}
          className={FIELD}
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={state === "busy"} className={PRIMARY}>
          {labels.save}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className={QUIET}
        >
          {labels.cancel}
        </button>
      </div>
      {state === "failed" ? (
        <p role="alert" className="text-meta">
          {labels.failed}
        </p>
      ) : null}
    </form>
  );
}
