import { MessageSquareText, X } from "lucide-react";

/**
 * The AI's speech, opened from under its pick (06 § 2): a native popover,
 * so the sheet stays without JavaScript of its own, and it sits in the
 * sheet, never in a portal the modal sheet would make inert. A tap opens it
 * on a phone, where a hover card would never show.
 */
export function AiSpeech({
  id,
  speech,
  labels,
}: {
  id: string;
  speech: string;
  labels: { open: string; title: string; close: string };
}) {
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        className="inline-flex min-h-11 w-fit items-center gap-2 text-body font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <MessageSquareText
          aria-hidden
          className="size-[1.125rem] text-icon-subtle"
          strokeWidth={2}
        />
        {labels.open}
      </button>
      <div
        id={id}
        popover="auto"
        role="dialog"
        aria-label={labels.title}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-[0.875rem] border border-border bg-card p-4 pt-1 text-card-foreground shadow-lg backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-meta text-muted-foreground">{labels.title}</p>
          <button
            type="button"
            popoverTarget={id}
            popoverTargetAction="hide"
            aria-label={labels.close}
            className="-me-3 grid size-11 place-items-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <X aria-hidden className="size-5" strokeWidth={2} />
          </button>
        </div>
        <p className="text-body">{speech}</p>
      </div>
    </>
  );
}
