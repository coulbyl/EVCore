import { getLocale, getTranslations } from "next-intl/server";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";
import type { AdminSectionKey } from "@/components/scoreboard/shell/shell-constants";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { displayLocaleOf, formatTime } from "@/helpers/scoreboard-format";

/**
 * The admin's band (maquettes AdminMobile, Admin): the screen's title and
 * the moment it is read. The screens are reached from the bar on a phone
 * (its four, then « Plus ») and from the rail on a wide screen.
 */
export async function AdminBand({ current }: { current: AdminSectionKey }) {
  const [t, locale, timeZone] = await Promise.all([
    getTranslations("console"),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  const now = new Date();
  const day = new Intl.DateTimeFormat(display === "en" ? "en-GB" : "fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone,
  }).format(now);

  return (
    <PlayerBand>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="score text-title font-bold">{t(`titles.${current}`)}</h1>
        <p className="text-meta text-band-muted">
          {day} · {formatTime(now, display, timeZone)}
        </p>
      </div>
    </PlayerBand>
  );
}
