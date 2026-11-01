import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { clsx } from "clsx";
import { getLocale, getTranslations } from "next-intl/server";
import { RichText } from "@/components/scoreboard/ui/rich-text";
import { getAnnouncements } from "@/domains/console/use-cases/get-console";
import type { AnnouncementView } from "@/domains/console/types/console";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { plainTextOf } from "@/helpers/plain-text";
import { displayLocaleOf, formatShortDate } from "@/helpers/scoreboard-format";
import { AdminBand } from "../../components/admin-band";
import { AnnouncementActions } from "../components/announcement-actions";
import { AnnouncementForm } from "../components/announcement-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console.players");
  return {
    title: `${t("announcements.title")} — EVCore`,
    robots: { index: false },
  };
}

type AnnouncementState = "published" | "draft" | "expired";

function stateOf(a: AnnouncementView, now: number): AnnouncementState {
  if (!a.published) return "draft";
  if (a.expiresAt && Date.parse(a.expiresAt) <= now) return "expired";
  return "published";
}

const STATE_LOOK: Record<AnnouncementState, string> = {
  published: "bg-win/15 text-win",
  draft: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground line-through",
};

/**
 * Joueurs › Annonces (revue admin du 01/11): every announcement — published,
 * draft, expired — with how many players read it, Modifier, Publier or
 * Dépublier, Supprimer; « Écrire » opens the form above the list, and so
 * does Modifier (`?new=1`, `?edit=<id>`).
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  const [params, t, locale, timeZone, all] = await Promise.all([
    searchParams,
    getTranslations("console.players"),
    getLocale(),
    getPlayerTimeZone(),
    getAnnouncements(),
  ]);
  const display = displayLocaleOf(locale);
  const day = (iso: string) =>
    formatShortDate(new Date(iso), display, timeZone);
  const now = Date.now();
  const editing = params.edit
    ? (all.find((a) => a.id === params.edit) ?? null)
    : null;
  const writing = params.new === "1" || editing !== null;
  const heading = "text-meta font-semibold text-muted-foreground";
  const a = (key: string) => t(`announcements.${key}`);

  return (
    <>
      <AdminBand current="players" />
      <div className="flex flex-col gap-5 px-4 pt-3 pb-4 lg:px-6">
        <Link
          href="/admin/players"
          className="text-meta font-medium underline-offset-4 hover:underline"
        >
          ‹ {t("sheet.back")}
        </Link>

        {writing ? (
          <section aria-labelledby="form-title" className="flex flex-col gap-2">
            <h2 id="form-title" className="score text-title font-semibold">
              {editing ? a("editTitle") : a("newTitle")}
            </h2>
            <AnnouncementForm
              // A new key per announcement: the editor starts from its text.
              key={editing?.id ?? "new"}
              announcement={editing}
              labels={{
                rule: t("announceRule"),
                title: t("titleField"),
                text: t("textField"),
                link: a("link"),
                linkHint: a("linkHint"),
                expires: a("expires"),
                expiresHint: a("expiresHint"),
                preview: t("preview"),
                bold: a("bold"),
                italic: a("italic"),
                list: a("list"),
                addLink: a("addLink"),
                linkPrompt: a("linkPrompt"),
                saveDraft: a("saveDraft"),
                publish: t("publish"),
                save: a("save"),
                cancel: a("cancel"),
                failed: a("failed"),
              }}
            />
          </section>
        ) : (
          <Link
            href="/admin/players/announcements?new=1"
            className="flex min-h-12 items-center justify-center gap-2 rounded-[0.625rem] bg-primary px-4 text-bet font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Plus aria-hidden className="size-5" strokeWidth={2} />
            {t("announce")}
          </Link>
        )}

        <section aria-labelledby="list-title" className="flex flex-col gap-1">
          <h2 id="list-title" className={heading}>
            {a("title")}
          </h2>
          {all.length === 0 ? (
            <p className="text-body text-muted-foreground">
              {t("noAnnouncements")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {all.map((item) => {
                const state = stateOf(item, now);
                return (
                  <li key={item.id} className="flex items-start gap-3 py-3">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-body font-semibold">
                          {plainTextOf(item.title)}
                        </span>
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-legal font-medium",
                            STATE_LOOK[state],
                          )}
                        >
                          {a(`states.${state}`)}
                        </span>
                      </span>
                      <RichText
                        html={item.description}
                        phrasing
                        className="line-clamp-3 text-meta text-muted-foreground"
                      />
                      <span className="text-legal text-muted-foreground">
                        {[
                          item.publishedAt
                            ? t("announcements.publishedOn", {
                                date: day(item.publishedAt),
                              })
                            : t("announcements.editedOn", {
                                date: day(item.updatedAt),
                              }),
                          item.expiresAt
                            ? t("announcements.expiresOn", {
                                date: day(item.expiresAt),
                              })
                            : null,
                          item.published
                            ? t("announcements.reads", { count: item.reads })
                            : null,
                          item.href ? item.href : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <AnnouncementActions
                      id={item.id}
                      published={item.published}
                      labels={{
                        edit: a("edit"),
                        publish: t("publish"),
                        unpublish: a("unpublish"),
                        remove: a("remove"),
                        removeQuestion: a("removeQuestion"),
                        confirm: a("removeConfirm"),
                        cancel: a("cancel"),
                        failed: a("actionFailed"),
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
