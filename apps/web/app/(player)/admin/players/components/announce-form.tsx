"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";

/**
 * « Écrire une annonce » (12-admin.md § 3): a title, a text, the
 * notification as the player will see it, and the rule recalled. Published
 * at once; the server journals it (G11).
 */
export function AnnounceForm({
  labels,
}: {
  labels: {
    title: string;
    text: string;
    preview: string;
    rule: string;
    publish: string;
    published: string;
    failed: string;
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">(
    "idle",
  );

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setState("busy");
    try {
      await playerFetch("/admin/announcements", {
        method: "POST",
        body: {
          title: title.trim(),
          description: text.trim(),
          published: true,
        },
      });
      setTitle("");
      setText("");
      setState("done");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  const field =
    "min-h-11 rounded-[0.625rem] border border-border bg-card px-3 py-2 text-body text-foreground";
  return (
    <form onSubmit={(e) => void publish(e)} className="flex flex-col gap-3">
      <p className="text-meta text-muted-foreground">{labels.rule}</p>
      <label className="flex flex-col gap-1 text-meta text-muted-foreground">
        {labels.title}
        <input
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1 text-meta text-muted-foreground">
        {labels.text}
        <textarea
          required
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={`${field} min-h-32`}
        />
      </label>
      {title || text ? (
        <div className="flex flex-col gap-1">
          <span className="text-meta text-muted-foreground">
            {labels.preview}
          </span>
          <div className="rounded-[0.875rem] border border-border bg-card p-3">
            <p className="text-body font-semibold">{title}</p>
            <p className="line-clamp-2 text-meta text-muted-foreground">
              {text}
            </p>
          </div>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={state === "busy" || !title.trim() || !text.trim()}
        className="h-12 rounded-[0.625rem] bg-primary text-bet font-medium text-primary-foreground disabled:opacity-50"
      >
        {labels.publish}
      </button>
      {state === "done" ? (
        <p role="status" className="text-meta text-win">
          {labels.published}
        </p>
      ) : state === "failed" ? (
        <p role="alert" className="text-meta text-loss">
          {labels.failed}
        </p>
      ) : null}
    </form>
  );
}
