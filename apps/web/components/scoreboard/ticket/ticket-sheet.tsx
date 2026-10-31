import { getLocale, getTranslations } from "next-intl/server";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { displayLocaleOf } from "@/helpers/scoreboard-format";
import { Sheet } from "../sheet/sheet";
import { activePause } from "../states/paused-screen";
import { TicketFooter, TicketView } from "./ticket-view";

/**
 * « Mon ticket » in the sheet, the same on a tap of the bar (intercepted
 * route) and on a link or a reload. The ticket is on the device: the sheet
 * renders on the client inside the server frame. Closed during a pause, the
 * ticket kept for its end (07 § 6).
 */
export async function TicketSheet() {
  if (await activePause()) return null;
  const [t, locale, timeZone] = await Promise.all([
    getTranslations("ticket"),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  return (
    <Sheet
      title={t("title")}
      fallbackHref="/matches"
      footer={<TicketFooter locale={display} timeZone={timeZone} />}
    >
      <TicketView locale={display} />
    </Sheet>
  );
}
