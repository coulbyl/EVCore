import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlayerSession } from "@/domains/auth/use-cases/get-player-session";
import { getLocale, getTranslations } from "next-intl/server";
import { SubpageBand } from "@/components/scoreboard/shell/subpage-band";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import type { SupportMessage } from "@/domains/support/types/support";
import { serverApiRequest } from "@/lib/api/server-api";
import { displayLocaleOf } from "@/helpers/scoreboard-format";
import { Composer } from "@/components/scoreboard/messages/composer";
import { ThreadList } from "@/components/scoreboard/messages/thread-list";
import { PushNudge } from "@/components/scoreboard/ui/push-nudge";
import { ThreadLive } from "@/components/scoreboard/messages/thread-live";

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
  const [t, params, locale, timeZone, current] = await Promise.all([
    getTranslations("messages"),
    searchParams,
    getLocale(),
    getPlayerTimeZone(),
    getPlayerSession(),
  ]);
  // The team has no support thread of its own: its messages are the
  // players' (12-admin.md § 3).
  if (current.status === "signed-in" && current.session.user.role === "ADMIN") {
    redirect("/admin/messages");
  }
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

  return (
    <>
      <SubpageBand
        title={t("title")}
        subtitle={t("subtitle")}
        back={{ href: "/me" }}
      />
      <PushNudge labels={{ text: t("pushNudge"), enable: t("pushEnable") }} />
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
        <ThreadList
          messages={messages}
          viewer="OPERATOR"
          teamSign={t("teamSign")}
          display={display}
          timeZone={timeZone}
          labels={{
            title: t("title"),
            today: t("today"),
            yesterday: t("yesterday"),
            ...labels,
          }}
        />
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
            mic: {
              denied: t("mic.denied"),
              notFound: t("mic.notFound"),
              busy: t("mic.busy"),
              unsupported: t("mic.unsupported"),
              unknown: t("mic.unknown"),
            },
            ...labels,
          }}
        />
      </div>
    </>
  );
}
