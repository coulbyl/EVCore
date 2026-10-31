import { clsx } from "clsx";
import type { SupportMessage } from "@/domains/support/types/support";

/**
 * One message of the thread (09 § 2, maquette Messages): mine on the right,
 * the team's on the left signed with the name of who answered and the time,
 * the automatic welcome in grey. A photo shows, a voice message plays.
 * No hooks: drawn on the server for the thread and in the composer for a
 * message being sent.
 */
export function MessageBubble({
  message,
  mine,
  sign,
  time,
  labels,
  footer,
}: {
  message: SupportMessage;
  mine: boolean;
  /** « Kouamé, équipe EVCore » for the team, nothing for mine. */
  sign: string | null;
  time: string;
  labels: { voice: string; image: string; file: string; automatic: string };
  /** « Envoi… », « Pas envoyé · Réessayer » under a message being sent. */
  footer?: React.ReactNode;
}) {
  const automatic = message.kind === "AUTOMATED";
  const attachment = message.attachment ?? null;
  // A photo alone is the bubble itself: no ink frame around it.
  const imageOnly = attachment?.kind === "IMAGE" && !message.content;
  return (
    <li
      className={clsx(
        "flex max-w-[85%] flex-col gap-1",
        mine ? "self-end items-end" : "self-start items-start",
      )}
    >
      <div
        className={clsx(
          "flex flex-col gap-2 rounded-[0.875rem] text-body",
          !imageOnly && "px-3.5 py-2.5",
          imageOnly
            ? "overflow-hidden border border-border"
            : automatic
              ? "bg-muted text-muted-foreground"
              : mine
                ? "rounded-br-sm bg-primary text-primary-foreground"
                : "rounded-bl-sm border border-border bg-card text-card-foreground",
        )}
      >
        {attachment?.kind === "IMAGE" ? (
          // A presigned, short-lived link: next/image would cache it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.url}
            alt={labels.image}
            width={attachment.width ?? undefined}
            height={attachment.height ?? undefined}
            loading="lazy"
            className={clsx(
              "h-auto max-h-72 max-w-full object-contain",
              !imageOnly && "rounded-md",
            )}
          />
        ) : attachment?.kind === "AUDIO" ? (
          <audio
            controls
            // The length shows before playing, without loading the sound.
            preload="metadata"
            src={attachment.url}
            aria-label={labels.voice}
            className="max-w-full"
          />
        ) : attachment ? (
          <a
            href={attachment.url}
            className="underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            {attachment.fileName ?? labels.file}
          </a>
        ) : null}
        {message.content ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : null}
      </div>
      <p className="text-legal text-muted-foreground">
        {[sign, automatic ? labels.automatic : null, time]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {footer}
    </li>
  );
}
