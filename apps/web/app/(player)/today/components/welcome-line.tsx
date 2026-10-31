import { cookies } from "next/headers";
import { after } from "next/server";
import { X } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { serverApiRequest } from "@/lib/api/server-api";
import type { TodayProductForm } from "@/domains/today/types/today";
import { displayLocaleOf, formatShortDate } from "@/helpers/scoreboard-format";

/**
 * The welcome line of the first launch (10 § 1), over the hero, once:
 * what we do (one bet a day, tracked and counted, with the hero product's
 * real count) and what we do not (take a stake). The app's only paragraph.
 *
 * Shown once: the account is marked seen after the response (`after`),
 * so the next visit has none. Closed without JavaScript: a checkbox and
 * CSS, nothing for the player's bundle.
 */
export async function WelcomeLine({
  form,
}: {
  /** The hero product's form, for « gagné 4 jours sur 5 ». */
  form: TodayProductForm | undefined;
}) {
  const [t, locale, cookieStore] = await Promise.all([
    getTranslations("today"),
    getLocale(),
    cookies(),
  ]);
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  after(() =>
    serverApiRequest("/auth/me", {
      method: "PATCH",
      body: { hasSeenOnboarding: true },
      cookieHeader,
    }).catch(() => {
      // Seen next time, then.
    }),
  );

  const since = form?.days[0]?.date;
  const text =
    form && since && form.played > 0
      ? t("welcome", {
          date: formatShortDate(
            new Date(`${since}T12:00:00Z`),
            displayLocaleOf(locale),
            "UTC",
          ),
          won: form.won,
          played: form.played,
        })
      : t("welcomeShort");

  return (
    <div className="flex items-start gap-3 rounded-[0.875rem] border border-border bg-card p-3 has-[:checked]:hidden">
      <p className="flex-1 text-body">{text}</p>
      <label className="-m-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
        <input
          type="checkbox"
          aria-label={t("welcomeClose")}
          className="sr-only"
        />
        <X aria-hidden strokeWidth={2} className="size-5" />
      </label>
    </div>
  );
}
