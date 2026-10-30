import { getLocale, getTranslations } from "next-intl/server";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";
import { activePauseEnd } from "@/domains/auth/types/auth";
import { getPlayerSession } from "@/domains/auth/use-cases/get-player-session";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import {
  displayLocaleOf,
  formatShortDate,
  formatTime,
} from "@/helpers/scoreboard-format";
import { PauseNotice } from "./pause-notice";

/**
 * The end of the signed-in player's pause, or null when not paused. A
 * paused player's Aujourd'hui and Matchs are closed (04 § 5, 06 § 4): the
 * server would refuse their reads.
 */
export async function activePause(): Promise<Date | null> {
  const session = await getPlayerSession();
  const end =
    session.status === "signed-in"
      ? activePauseEnd(session.session.user.pausedUntil)
      : null;
  return end ? new Date(end) : null;
}

/** La pause, à la place de l'écran (04 § 5, maquette Pause). */
export async function PausedScreen({
  until,
  title,
}: {
  until: Date;
  title: string;
}) {
  const [t, locale, timeZone] = await Promise.all([
    getTranslations("scoreboard.states"),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  return (
    <>
      <PlayerBand />
      <h1 className="sr-only">{title}</h1>
      <div className="px-4 pt-4 lg:px-6">
        <PauseNotice
          until={t("pauseUntil", {
            date: formatShortDate(until, display, timeZone),
            time: formatTime(until, display, timeZone),
          })}
        />
      </div>
    </>
  );
}
