import Link from "next/link";
import { clsx } from "clsx";
import { getLocale, getTranslations } from "next-intl/server";
import type {
  SupportConversationSummary,
  SupportMessage,
} from "@/domains/support/types/support";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import {
  displayLocaleOf,
  formatShortDate,
  formatTime,
} from "@/helpers/scoreboard-format";
import { sortConversations } from "./conversations-constants";

/**
 * The conversations in the order one acts (12-admin.md § 3): « À répondre »
 * (the player wrote last, the oldest wait first), then the other
 * exchanges; the players who never wrote (the welcome, a greeting, a
 * message the team started) are counted, shown on demand. The search narrows all three.
 */
export async function ConversationList({
  conversations,
  query,
  showSilent,
  activeId,
}: {
  conversations: readonly SupportConversationSummary[];
  query: string;
  showSilent: boolean;
  /** The thread open next to the list on a wide screen. */
  activeId?: string;
}) {
  const [t, m, locale, timeZone] = await Promise.all([
    getTranslations("console.messages"),
    getTranslations("messages"),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  const { toAnswer, others, silent } = sortConversations(conversations, query);
  const todayKey = formatShortDate(new Date(), display, timeZone);
  const when = (iso: string) => {
    const date = new Date(iso);
    const day = formatShortDate(date, display, timeZone);
    return day === todayKey ? formatTime(date, display, timeZone) : day;
  };
  const preview = (message: SupportMessage | null) => {
    if (!message) return "";
    const text =
      message.content ??
      (message.attachment?.kind === "AUDIO"
        ? m("voice")
        : message.attachment?.kind === "IMAGE"
          ? m("image")
          : m("file"));
    return message.senderRole === "ADMIN" ? `${t("you")}${text}` : text;
  };
  const heading = "text-meta font-semibold text-muted-foreground";
  const qs = (over: { silent?: boolean }) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (over.silent ?? showSilent) p.set("silent", "1");
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  const rows = (list: SupportConversationSummary[], waiting: boolean) => (
    <ul className="divide-y divide-border">
      {list.map((c) => (
        <li key={c.id}>
          <Link
            href={`/admin/messages/${c.id}${qs({})}`}
            aria-current={c.id === activeId ? "page" : undefined}
            className={clsx(
              "flex min-h-14 flex-col justify-center gap-0.5 py-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              c.id === activeId && "bg-muted/60 -mx-2 rounded-[0.625rem] px-2",
            )}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span
                className={clsx(
                  "truncate text-body",
                  c.unreadCount > 0 ? "font-semibold" : "font-medium",
                )}
              >
                {c.fullName}
              </span>
              <span className="score shrink-0 text-meta text-muted-foreground">
                {waiting
                  ? t("waitingFor", { time: when(c.lastMessageAt) })
                  : when(c.lastMessageAt)}
              </span>
            </span>
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate text-meta text-muted-foreground">
                {preview(c.lastMessage)}
              </span>
              {c.unreadCount > 0 ? (
                <span className="shrink-0 text-meta font-semibold text-foreground">
                  {t("unread", { count: c.unreadCount })}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-4">
      <form action="/admin/messages" method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          aria-label={t("search")}
          placeholder={t("search")}
          className="min-h-11 min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-body"
        />
        <button
          type="submit"
          className="min-h-11 rounded-full border border-border px-4 text-body font-medium"
        >
          {t("searchSubmit")}
        </button>
      </form>

      {toAnswer.length + others.length + silent.length === 0 ? (
        <p className="text-body text-muted-foreground">
          {query ? t("noMatch") : t("none")}
        </p>
      ) : null}

      {toAnswer.length > 0 ? (
        <section aria-labelledby="to-answer" className="flex flex-col gap-1">
          <h2 id="to-answer" className={heading}>
            {t("toAnswer")} · {toAnswer.length}
          </h2>
          {rows(toAnswer, true)}
        </section>
      ) : null}

      {others.length > 0 ? (
        <section aria-labelledby="others" className="flex flex-col gap-1">
          <h2 id="others" className={heading}>
            {t("others")}
          </h2>
          {rows(others, false)}
        </section>
      ) : null}

      {silent.length > 0 ? (
        showSilent || query ? (
          <section aria-labelledby="silent" className="flex flex-col gap-1">
            <h2 id="silent" className={heading}>
              {t("silent", { count: silent.length })}
            </h2>
            {rows(silent, false)}
          </section>
        ) : (
          <p className="text-meta text-muted-foreground">
            {t("silent", { count: silent.length })} ·{" "}
            <Link
              href={`/admin/messages${qs({ silent: true })}`}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {t("showSilent")}
            </Link>
          </p>
        )
      ) : null}
    </div>
  );
}
