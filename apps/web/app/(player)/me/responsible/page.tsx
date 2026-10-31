import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { SubpageBand } from "@/components/scoreboard/shell/subpage-band";
import { activePauseEnd } from "@/domains/auth/types/auth";
import { getPlayerSession } from "@/domains/auth/use-cases/get-player-session";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import {
  displayLocaleOf,
  formatShortDate,
  formatTime,
} from "@/helpers/scoreboard-format";
import { DeleteAccount } from "./components/delete-account";
import { PauseChooser } from "./components/pause-chooser";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("responsible");
  return { title: `${t("title")} — EVCore` };
}

/** The lengths of the break, in days (apps/backend config/pause.constants.ts). */
const PAUSE_DAYS = [1, 7, 30] as const;
const DAY_MS = 86_400_000;

/**
 * « Jeu responsable » (09 § 4, maquette JeuResponsable) : la seule page de
 * Moi avec une phrase d'intro. La pause (trois durées, confirmée en une
 * ligne, prolongeable, jamais écourtée), une ligne d'aide et le lien vers
 * les numéros par pays, puis « Supprimer mon compte ». Ouverte pendant une
 * pause : c'est là qu'on la prolonge.
 */
export default async function Page() {
  const [t, session, locale, timeZone] = await Promise.all([
    getTranslations("responsible"),
    getPlayerSession(),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  const at = (date: Date) =>
    t("dateAt", {
      date: formatShortDate(date, display, timeZone),
      time: formatTime(date, display, timeZone),
    });
  const pauseEnd =
    session.status === "signed-in"
      ? activePauseEnd(session.session.user.pausedUntil)
      : null;
  const now = Date.now();
  // A running break only extends: the lengths that would end sooner go.
  const durations = PAUSE_DAYS.map((days) => ({
    days,
    label: t(`durations.${days}`),
    end: new Date(now + days * DAY_MS),
  }))
    .filter((d) => !pauseEnd || d.end.getTime() > Date.parse(pauseEnd))
    .map(({ days, label, end }) => ({ days, label, endsAt: at(end) }));

  return (
    <>
      <SubpageBand
        title={t("title")}
        back={{ href: "/me", label: t("back") }}
      />
      <div className="flex flex-col divide-y divide-border px-4 pb-4 lg:px-6">
        <section className="flex flex-col gap-3 py-4">
          <p className="text-body">{t("intro")}</p>
          {pauseEnd ? (
            <p className="score text-bet font-semibold">
              {t("pausedUntil", { date: at(new Date(pauseEnd)) })}
            </p>
          ) : null}
          {durations.length > 0 ? (
            <PauseChooser
              durations={durations}
              labels={{
                group: t("durationsLabel"),
                confirmLine: t.raw("confirmLine") as string,
                confirm: t("confirm"),
                cancel: t("cancel"),
                failed: t("pauseFailed"),
              }}
            />
          ) : null}
          <p className="text-meta text-muted-foreground">
            {pauseEnd ? `${t("extendOnly")} ` : null}
            {t("note")}
          </p>
        </section>

        <section className="flex flex-col gap-1 py-4">
          <h2 className="text-body font-semibold">{t("helpTitle")}</h2>
          <p className="text-body">{t("helpLine")}</p>
          <Link
            href="/jeu-responsable"
            className="self-start py-2 text-body font-medium underline underline-offset-4"
          >
            {t("helpNumbers")} ›
          </Link>
        </section>

        <details className="group py-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-body font-medium focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            {t("delete")}
            <span
              aria-hidden
              className="text-muted-foreground group-open:rotate-90"
            >
              ›
            </span>
          </summary>
          <p className="text-meta text-muted-foreground">{t("deleteWhat")}</p>
          <DeleteAccount
            labels={{
              password: t("password"),
              confirm: t("deleteConfirm"),
              failed: t("deleteFailed"),
            }}
          />
        </details>
      </div>
    </>
  );
}
