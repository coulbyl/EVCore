import type { SupportMessage } from "@/domains/support/types/support";
import { formatTime, type DisplayLocale } from "@/helpers/scoreboard-format";
import { MessageBubble } from "./message-bubble";

const INTL: Record<string, string> = { fr: "fr-FR", en: "en-GB" };

/**
 * A support thread's messages (09 § 2, 12 § 3), the days as headings. The
 * same list for both sides: the player sees the team's messages signed,
 * the admin sees the player's on the left and the team's on the right.
 */
export function ThreadList({
  messages,
  viewer,
  teamSign,
  display,
  timeZone,
  labels,
}: {
  messages: readonly SupportMessage[];
  /** Whose thread it is on screen: their messages sit on the right. */
  viewer: "OPERATOR" | "ADMIN";
  /** « L'équipe EVCore » under the team's messages, for the player. */
  teamSign: string | null;
  display: DisplayLocale;
  timeZone: string;
  labels: {
    title: string;
    today: string;
    yesterday: string;
    voice: string;
    image: string;
    file: string;
    automatic: string;
  };
}) {
  const dayOf = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(iso));
  const todayKey = dayOf(new Date().toISOString());
  const yesterdayKey = dayOf(new Date(Date.now() - 86_400_000).toISOString());
  const heading = (iso: string) => {
    const key = dayOf(iso);
    if (key === todayKey) return labels.today;
    if (key === yesterdayKey) return labels.yesterday;
    return new Intl.DateTimeFormat(INTL[display], {
      weekday: "short",
      day: "numeric",
      month: "long",
      timeZone,
    }).format(new Date(iso));
  };
  const bubbleLabels = {
    voice: labels.voice,
    image: labels.image,
    file: labels.file,
    automatic: labels.automatic,
  };

  return (
    <ol aria-label={labels.title} className="flex flex-col gap-3 pb-3">
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const newDay =
          !previous || dayOf(previous.createdAt) !== dayOf(message.createdAt);
        const mine = message.senderRole === viewer;
        const team = message.senderRole === "ADMIN";
        return [
          newDay ? (
            <li
              key={`day-${message.id}`}
              aria-hidden
              className="self-center pt-2 text-legal text-muted-foreground"
            >
              {heading(message.createdAt)}
            </li>
          ) : null,
          <MessageBubble
            key={message.id}
            message={message}
            mine={mine}
            sign={
              !mine && team && message.kind !== "AUTOMATED" ? teamSign : null
            }
            time={formatTime(new Date(message.createdAt), display, timeZone)}
            labels={bubbleLabels}
          />,
        ];
      })}
    </ol>
  );
}
