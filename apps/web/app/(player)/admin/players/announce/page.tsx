import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getAnnouncements } from "@/domains/console/use-cases/get-console";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { plainTextOf } from "@/helpers/plain-text";
import { displayLocaleOf, formatShortDate } from "@/helpers/scoreboard-format";
import { AdminBand } from "../../components/admin-band";
import { AnnounceForm } from "../components/announce-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console.players");
  return { title: `${t("announceTitle")} — EVCore`, robots: { index: false } };
}

/**
 * « Écrire une annonce », an action of Joueurs, not a section (12 § 3):
 * the form, then the past announcements. Old ones written in the rich
 * editor read as text.
 */
export default async function Page() {
  const [t, locale, timeZone, past] = await Promise.all([
    getTranslations("console.players"),
    getLocale(),
    getPlayerTimeZone(),
    getAnnouncements(),
  ]);
  const display = displayLocaleOf(locale);
  const heading = "text-meta font-semibold text-muted-foreground";

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
        <h2 className="score text-title font-semibold">{t("announceTitle")}</h2>
        <AnnounceForm
          labels={{
            title: t("titleField"),
            text: t("textField"),
            preview: t("preview"),
            rule: t("announceRule"),
            publish: t("publish"),
            published: t("published"),
            failed: t("publishFailed"),
          }}
        />
        <section aria-labelledby="past-title" className="flex flex-col gap-1">
          <h3 id="past-title" className={heading}>
            {t("pastTitle")}
          </h3>
          {past.length === 0 ? (
            <p className="text-body text-muted-foreground">
              {t("noAnnouncements")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {past.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 py-2">
                  <span className="text-body font-medium">
                    {plainTextOf(a.title)}
                  </span>
                  <span className="text-meta text-muted-foreground">
                    {a.published && a.publishedAt
                      ? formatShortDate(
                          new Date(a.publishedAt),
                          display,
                          timeZone,
                        )
                      : t("draft")}
                    {" · "}
                    {plainTextOf(a.description).slice(0, 120)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
