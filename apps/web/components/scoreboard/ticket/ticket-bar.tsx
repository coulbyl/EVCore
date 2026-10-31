"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Ticket } from "lucide-react";
import { formatOdds, type DisplayLocale } from "@/helpers/scoreboard-format";
import { useOnline } from "../states/use-online";
import { usePlayerText } from "../text/player-texts";
import { quoteTicket } from "./quote-ticket";
import { currentQuote } from "./ticket-store";
import { TicketChance } from "./ticket-chance";
import { useTicket } from "./use-ticket";

/** The screens where the bar shows (07 § 2): Matchs and Aujourd'hui. */
const SHOWN_ON = ["/today", "/matches"];

/**
 * « Mon ticket » above the tabs as soon as one bet is in it (07 § 2):
 * the number of matches, the total odds, the chance, and a tap opens the
 * sheet. Three figures, all from the last quote of this composition; a new
 * composition is quoted at once (online), the figures wait for it.

 *
 * Gone when the ticket is empty, on the other tabs, and during a pause
 * (`paused`): the ticket stays on the device for the end of the pause.
 */
export default function TicketBar({
  locale,
  paused,
}: {
  locale: DisplayLocale;
  paused: boolean;
}) {
  const t = usePlayerText("ticket");
  const pathname = usePathname();
  const online = useOnline();
  const ticket = useTicket();
  const quote = currentQuote(ticket);
  const count = ticket.legs.length;
  const shown =
    !paused &&
    count > 0 &&
    SHOWN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (paused || count === 0 || quote || !online) return;
    quoteTicket(ticket.legs, false).catch(() => {
      // The bar keeps the count; the sheet says when the quote fails.
    });
  }, [paused, count, quote, online, ticket.legs]);

  if (!shown) return null;
  const totals = quote?.totals ?? null;

  return (
    <>
      {/* Keeps the end of the list clear of the bar. */}
      <div aria-hidden className="h-15 lg:hidden" />
      <Link
        href="/ticket"
        aria-label={t("open")}
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex min-h-15 items-center gap-2 whitespace-nowrap bg-band px-4 sm:gap-3 text-band-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-led-on lg:sticky lg:bottom-4 lg:mx-4 lg:rounded-[0.875rem] lg:px-5"
      >
        <Ticket
          aria-hidden
          strokeWidth={2}
          className="hidden size-5 shrink-0 sm:block"
        />
        <span className="text-body font-semibold">{t("title")}</span>
        <span className="score text-bet font-semibold text-band-muted">
          {count === 1
            ? t("matchOne")
            : t("matchMany", { count: String(count) })}
          {totals ? (
            <>
              {" · "}
              <span className="text-band-foreground">
                {formatOdds(totals.odds, locale)}
              </span>
            </>
          ) : null}
        </span>
        {totals ? (
          <TicketChance
            probability={totals.chance}
            phrasing={totals.legCount === 1 ? "short" : "about"}
            showLeds={false}
            className="ms-auto text-bet"
          />
        ) : (
          <span className="ms-auto" />
        )}
        <ChevronRight
          aria-hidden
          strokeWidth={2}
          className="size-[1.125rem] shrink-0 text-band-muted"
        />
      </Link>
    </>
  );
}
