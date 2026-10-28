"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

/**
 * Ce que voit le joueur en pause à la place des coupons, de Décisions, des
 * avis IA et de la fiche de match : jusqu'à quand, et où retrouver son
 * historique, qui reste ouvert (jeu responsable, décision du 2026-10-28).
 */
export function PausedNotice({ until }: { until: string }) {
  const t = useTranslations("pause");
  const locale = useLocale();
  const end = new Date(until).toLocaleString(
    locale === "en" ? "en-GB" : "fr-FR",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return (
    <section
      data-testid="paused-notice"
      className="mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-border bg-panel p-5 text-sm leading-6"
    >
      <h2 className="text-base font-semibold text-foreground">{t("title")}</h2>
      <p className="text-foreground">
        {/* Heure locale du joueur : calculée côté client. */}
        <span suppressHydrationWarning>{t("until", { end })}</span>
      </p>
      <p className="text-muted-foreground">{t("body")}</p>
      <ul className="flex flex-wrap gap-x-5">
        {(
          [
            ["/dashboard/bet-slips", "mySlips"],
            ["/dashboard/bankroll", "bankroll"],
            ["/dashboard/track-record", "trackRecord"],
          ] as const
        ).map(([href, key]) => (
          <li key={href}>
            <Link
              href={href}
              className="inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4"
            >
              {t(`links.${key}`)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
