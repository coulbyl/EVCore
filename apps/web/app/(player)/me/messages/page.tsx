import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { SubpageBand } from "@/components/scoreboard/shell/subpage-band";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import type { SupportMessage } from "@/domains/support/types/support";
import { serverApiRequest } from "@/lib/api/server-api";
import { displayLocaleOf, formatTime } from "@/helpers/scoreboard-format";
import { Composer } from "./components/composer";
import { MessageBubble } from "./components/message-bubble";
import { ThreadLive } from "./components/thread-live";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("messages");
  return { title: `${t("title")} — EVCore` };
}

type Conversation = {
  conversation: { userReadAt: string | null };
  messages: SupportMessage[];
  hasMore: boolean;
};

/** « Messages précédents » pages read at most on top of the latest. */
const MAX_OLDER = 10;
const INTL: Record<string, string> = { fr: "fr-FR", en: "en-GB" };

/**
 * « Messages » (09 § 2, maquette Messages) : une seule conversation avec
 * l'équipe, rendue côté serveur (GET /support/conversation ; le message
 * d'accueil automatique, une fois par fil, est posé par le serveur), les
 * jours en intertitres, les messages de l'équipe signés. En bas, le
 * composeur : texte, photo, message vocal. Ouvrir le fil marque tout lu.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ older?: string }>;
}) {
  const [t, params, locale, timeZone] = await Promise.all([
    getTranslations("messages"),
    searchParams,
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  const older = Math.min(MAX_OLDER, Math.max(0, Number(params.older) || 0));

  const thread = await serverApiRequest<Conversation>("/support/conversation");
  let messages = thread.messages;
  let hasMore = thread.hasMore;
  for (let page = 0; page < older && hasMore && messages[0]; page += 1) {
    const before = await serverApiRequest<{
      messages: SupportMessage[];
      hasMore: boolean;
    }>(`/support/messages/before/${encodeURIComponent(messages[0].id)}`);
    messages = [...before.messages, ...messages];
    hasMore = before.hasMore;
  }

  const readAt = thread.conversation.userReadAt
    ? Date.parse(thread.conversation.userReadAt)
    : 0;
  const unread = messages.some(
    (m) => m.senderRole === "ADMIN" && Date.parse(m.createdAt) > readAt,
  );
  const labels = {
    voice: t("voice"),
    image: t("image"),
    file: t("file"),
    automatic: t("automatic"),
  };

  const dayOf = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(iso));
  const todayKey = dayOf(new Date().toISOString());
  const yesterdayKey = dayOf(new Date(Date.now() - 86_400_000).toISOString());
  const heading = (iso: string) => {
    const key = dayOf(iso);
    if (key === todayKey) return t("today");
    if (key === yesterdayKey) return t("yesterday");
    return new Intl.DateTimeFormat(INTL[display], {
      weekday: "short",
      day: "numeric",
      month: "long",
      timeZone,
    }).format(new Date(iso));
  };

  return (
    <>
      <SubpageBand
        title={t("title")}
        subtitle={t("subtitle")}
        back={{ href: "/me", label: t("back") }}
      />
      <ThreadLive unread={unread} />
      <div className="flex flex-col px-4 pt-3 lg:px-6">
        {hasMore ? (
          <Link
            href={`/me/messages?older=${older + 1}`}
            scroll={false}
            className="self-center py-2 text-meta font-medium underline underline-offset-4"
          >
            {t("older")}
          </Link>
        ) : null}
        {messages.length === 0 ? (
          <p className="py-6 text-body text-muted-foreground">{t("empty")}</p>
        ) : null}
        <ol aria-label={t("title")} className="flex flex-col gap-3 pb-3">
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const newDay =
              !previous ||
              dayOf(previous.createdAt) !== dayOf(message.createdAt);
            const mine = message.senderRole === "OPERATOR";
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
                  mine || message.kind === "AUTOMATED" ? null : t("teamSign")
                }
                time={formatTime(
                  new Date(message.createdAt),
                  display,
                  timeZone,
                )}
                labels={labels}
              />,
            ];
          })}
        </ol>
        <Composer
          serverIds={messages.map((m) => m.id)}
          timeFormat={{ locale: INTL[display] ?? "fr-FR", timeZone }}
          labels={{
            placeholder: t("placeholder"),
            send: t("send"),
            photo: t("photo"),
            record: t("record"),
            stop: t("stop"),
            recording: t("recording"),
            sendVoice: t("sendVoice"),
            cancel: t("cancel"),
            sending: t("sending"),
            failed: t("failed"),
            retry: t("retry"),
            tooBig: t("tooBig"),
            micDenied: t("micDenied"),
            ...labels,
          }}
        />
      </div>
    </>
  );
}
