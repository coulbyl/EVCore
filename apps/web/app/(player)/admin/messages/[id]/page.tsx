import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Composer } from "@/components/scoreboard/messages/composer";
import { ThreadList } from "@/components/scoreboard/messages/thread-list";
import { ThreadLive } from "@/components/scoreboard/messages/thread-live";
import { SubpageBand } from "@/components/scoreboard/shell/subpage-band";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import {
  getAdminOlder,
  getAdminThread,
} from "@/domains/support/use-cases/get-admin-support";
import { displayLocaleOf } from "@/helpers/scoreboard-format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console");
  return {
    title: `${t("titles.messages")} — EVCore`,
    robots: { index: false },
  };
}

/** « Messages précédents » pages read at most on top of the latest. */
const MAX_OLDER = 10;
const INTL: Record<string, string> = { fr: "fr-FR", en: "en-GB" };

/**
 * One player's thread, as the team answers it (12-admin.md § 3): the same
 * bubbles, photo and voice as the player's Messages, the player on the
 * left, the team on the right. Opening it marks it read for the team.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ older?: string }>;
}) {
  const [{ id }, query, t, m, locale, timeZone] = await Promise.all([
    params,
    searchParams,
    getTranslations("console.messages"),
    getTranslations("messages"),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const thread = await getAdminThread(id).catch(() => null);
  if (!thread) notFound();
  const display = displayLocaleOf(locale);
  const older = Math.min(MAX_OLDER, Math.max(0, Number(query.older) || 0));
  const player = thread.player;
  // Unread for the team: a player's message after the team last read.
  const readAt = thread.adminReadAt ? Date.parse(thread.adminReadAt) : 0;
  const unread = thread.messages.some(
    (message) =>
      message.senderRole === "OPERATOR" &&
      Date.parse(message.createdAt) > readAt,
  );
  let messages = thread.messages;
  let hasMore = thread.hasMore;
  for (let page = 0; page < older && hasMore && messages[0]; page += 1) {
    const before = await getAdminOlder({ id, before: messages[0].id });
    messages = [...before.messages, ...messages];
    hasMore = before.hasMore;
  }
  const labels = {
    voice: m("voice"),
    image: m("image"),
    file: m("file"),
    automatic: m("automatic"),
  };
  const base = `/admin/support/conversations/${encodeURIComponent(id)}`;

  return (
    <>
      <SubpageBand
        title={player.fullName}
        back={{ href: "/admin/messages", label: t("back") }}
      />
      <ThreadLive unread={unread} readPath={`${base}/read`} />
      <div className="flex flex-col px-4 pt-1 lg:px-6">
        <Link
          href={`/admin/players/${player.id}`}
          className="flex min-h-11 items-center justify-between border-b border-border text-body font-medium"
        >
          {t("sheet")}
          <ChevronRight
            aria-hidden
            className="size-[1.125rem] text-icon-subtle"
          />
        </Link>
        {hasMore ? (
          <Link
            href={`/admin/messages/${id}?older=${older + 1}`}
            scroll={false}
            className="self-center py-2 text-meta font-medium underline underline-offset-4"
          >
            {t("older")}
          </Link>
        ) : null}
        <div className="pt-2">
          <ThreadList
            messages={messages}
            viewer="ADMIN"
            teamSign={null}
            display={display}
            timeZone={timeZone}
            labels={{
              title: player.fullName,
              today: m("today"),
              yesterday: m("yesterday"),
              ...labels,
            }}
          />
        </div>
        <Composer
          serverIds={messages.map((message) => message.id)}
          timeFormat={{ locale: INTL[display] ?? "fr-FR", timeZone }}
          thread={{
            senderRole: "ADMIN",
            sendPath: `${base}/messages`,
            uploadUrlPath: `${base}/attachments/upload-url`,
          }}
          labels={{
            placeholder: t("placeholder", { name: player.fullName }),
            send: m("send"),
            photo: m("photo"),
            record: m("record"),
            stop: m("stop"),
            recording: m("recording"),
            sendVoice: m("sendVoice"),
            cancel: m("cancel"),
            sending: m("sending"),
            failed: m("failed"),
            retry: m("retry"),
            tooBig: m("tooBig"),
            mic: {
              denied: m("mic.denied"),
              notFound: m("mic.notFound"),
              busy: m("mic.busy"),
              unsupported: m("mic.unsupported"),
              unknown: m("mic.unknown"),
            },
            ...labels,
          }}
        />
      </div>
    </>
  );
}
