"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bold, Italic, Link2, List } from "lucide-react";
import { FIELD, PRIMARY, QUIET } from "@/components/scoreboard/ui/form-looks";
import { RichText } from "@/components/scoreboard/ui/rich-text";
import type { AnnouncementView } from "@/domains/console/types/console";
import { cleanRichHtml, safeHref } from "@/helpers/rich-text";
import { playerFetch } from "@/lib/api/player-fetch";

export type AnnouncementFormLabels = {
  rule: string;
  title: string;
  text: string;
  link: string;
  linkHint: string;
  expires: string;
  expiresHint: string;
  preview: string;
  bold: string;
  italic: string;
  list: string;
  addLink: string;
  linkPrompt: string;
  saveDraft: string;
  publish: string;
  save: string;
  cancel: string;
  failed: string;
};

/** « 2026-11-08T08:00:00Z » → the local « 2026-11-08T09:00 » a datetime field takes. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * Writing or editing an announcement (revue admin du 01/11, l'ancienne page
 * retrouvée): a title, a text with a light bar (bold, italic, list, link),
 * the notification as the player will see it, an optional link and an
 * expiry. Saved as a draft or published; editing a published one saves it
 * without notifying anyone again. The text is cleaned to the safe subset
 * before it leaves (helpers/rich-text.ts).
 */
export function AnnouncementForm({
  announcement,
  labels,
}: {
  /** Editing this one; a new announcement otherwise. */
  announcement: AnnouncementView | null;
  labels: AnnouncementFormLabels;
}) {
  const router = useRouter();
  const editor = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [html, setHtml] = useState(
    cleanRichHtml(announcement?.description ?? ""),
  );
  const [href, setHref] = useState(announcement?.href ?? "");
  const [expires, setExpires] = useState(
    toLocalInput(announcement?.expiresAt ?? null),
  );
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  // The starting text, cleaned, set once: bound to the state, the editor
  // would be rewritten on every key and lose the cursor.
  const [initial] = useState(html);
  useEffect(() => {
    if (editor.current) editor.current.innerHTML = initial;
  }, [initial]);

  const read = () => setHtml(cleanRichHtml(editor.current?.innerHTML ?? ""));
  const command = (name: string, value?: string) => {
    editor.current?.focus();
    // execCommand is deprecated but still the one tool every browser has
    // for a contenteditable; the result is cleaned before it is kept.
    document.execCommand(name, false, value);
    read();
  };
  const addLink = () => {
    const raw = window.prompt(labels.linkPrompt, "https://");
    const link = raw ? safeHref(raw) : null;
    if (link) command("createLink", link);
  };

  async function save(publish: boolean | null) {
    const description = cleanRichHtml(editor.current?.innerHTML ?? html);
    if (!title.trim() || !description) return;
    setState("busy");
    const body = {
      title: title.trim(),
      description,
      href: href.trim(),
      expiresAt: expires ? new Date(expires).toISOString() : "",
      ...(publish !== null && { published: publish }),
    };
    try {
      if (announcement) {
        await playerFetch(`/admin/announcements/${announcement.id}`, {
          method: "PATCH",
          body: { ...body, expiresAt: body.expiresAt || null },
        });
      } else {
        await playerFetch("/admin/announcements", {
          method: "POST",
          body: {
            ...body,
            href: body.href || undefined,
            expiresAt: body.expiresAt || undefined,
          },
        });
      }
      setState("idle");
      router.push("/admin/players/announcements");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  const tool =
    "flex size-10 items-center justify-center rounded-[0.5rem] hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(announcement ? null : true);
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-meta text-muted-foreground">{labels.rule}</p>
      <label className="flex flex-col gap-1 text-meta text-muted-foreground">
        {labels.title}
        <input
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={FIELD}
        />
      </label>

      <div className="flex flex-col gap-1">
        <span
          id="announcement-text"
          className="text-meta text-muted-foreground"
        >
          {labels.text}
        </span>
        <div className="overflow-hidden rounded-[0.625rem] border border-icon-subtle bg-card focus-within:outline-2 focus-within:outline-ring">
          <div
            role="toolbar"
            aria-label={labels.text}
            className="flex gap-1 border-b border-border px-1 py-1"
          >
            <button
              type="button"
              aria-label={labels.bold}
              title={labels.bold}
              onClick={() => command("bold")}
              className={tool}
            >
              <Bold aria-hidden className="size-4" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              aria-label={labels.italic}
              title={labels.italic}
              onClick={() => command("italic")}
              className={tool}
            >
              <Italic aria-hidden className="size-4" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              aria-label={labels.list}
              title={labels.list}
              onClick={() => command("insertUnorderedList")}
              className={tool}
            >
              <List aria-hidden className="size-4" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              aria-label={labels.addLink}
              title={labels.addLink}
              onClick={addLink}
              className={tool}
            >
              <Link2 aria-hidden className="size-4" strokeWidth={2.2} />
            </button>
          </div>
          <div
            ref={editor}
            role="textbox"
            aria-multiline="true"
            aria-labelledby="announcement-text"
            contentEditable
            onInput={read}
            onBlur={read}
            className="min-h-32 px-3 py-2 text-body text-foreground outline-none [&_a]:underline [&_li]:ms-5 [&_ul]:list-disc"
          />
        </div>
      </div>

      <label className="flex flex-col gap-1 text-meta text-muted-foreground">
        {labels.link}
        <input
          value={href}
          maxLength={500}
          placeholder="/today"
          onChange={(e) => setHref(e.target.value)}
          className={FIELD}
        />
        <span>{labels.linkHint}</span>
      </label>
      <label className="flex flex-col gap-1 text-meta text-muted-foreground">
        {labels.expires}
        <input
          type="datetime-local"
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
          className={FIELD}
        />
        <span>{labels.expiresHint}</span>
      </label>

      <section aria-label={labels.preview} className="flex flex-col gap-1">
        <p className="text-meta text-muted-foreground">{labels.preview}</p>
        <div className="flex flex-col gap-0.5 rounded-[0.75rem] border border-border bg-card px-3 py-2.5">
          <span className="text-body font-semibold">{title || "—"}</span>
          <RichText
            html={html}
            phrasing
            linkable={false}
            className="text-meta text-muted-foreground"
          />
        </div>
      </section>

      {state === "failed" ? (
        <p role="alert" className="text-meta text-loss">
          {labels.failed}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {announcement ? (
          <button
            type="submit"
            disabled={state === "busy"}
            className={`${PRIMARY} flex-1`}
          >
            {labels.save}
          </button>
        ) : (
          <>
            <button
              type="submit"
              disabled={state === "busy"}
              className={`${PRIMARY} flex-1`}
            >
              {labels.publish}
            </button>
            <button
              type="button"
              disabled={state === "busy"}
              onClick={() => void save(false)}
              className="min-h-12 rounded-[0.625rem] border border-border px-4 text-bet font-medium"
            >
              {labels.saveDraft}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => router.push("/admin/players/announcements")}
          className={QUIET}
        >
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}
