"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { clsx } from "clsx";
import { usePlayerText } from "../text/player-texts";
import { addToTicket, removeFromTicket, TICKET_MAX_LEGS } from "./ticket-store";
import type { TicketLeg } from "./ticket-types";
import { useTicket } from "./use-ticket";

/**
 * The [+] of a bet in the match sheet (06 § 2, 07 § 4): adds it to « Mon
 * ticket », ✓ once in it (a second tap takes it out). A bet on a match
 * already in the ticket replaces the other, and says so once: « Un seul pari
 * par match ». Full: « 15 au plus ». Only shown for a match still to come
 * that 1xBet prices (the sheet decides).
 */
export function AddToTicket({ leg }: { leg: Omit<TicketLeg, "oddsMoved"> }) {
  const t = usePlayerText("ticket");
  const ticket = useTicket();
  const [said, setSaid] = useState<string | null>(null);
  const inTicket = ticket.legs.some(
    (l) =>
      l.fixtureId === leg.fixtureId &&
      l.market === leg.market &&
      l.pick === leg.pick,
  );
  const full =
    !inTicket &&
    ticket.legs.length >= TICKET_MAX_LEGS &&
    !ticket.legs.some((l) => l.fixtureId === leg.fixtureId);

  function toggle() {
    if (inTicket) {
      removeFromTicket(leg.fixtureId);
      setSaid(null);
      return;
    }
    const result = addToTicket(leg);
    setSaid(
      result === "replaced"
        ? t("onePerMatch")
        : result === "full"
          ? t("full")
          : null,
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {said ? (
        <span role="status" className="text-legal text-muted-foreground">
          {said}
        </span>
      ) : null}
      {full ? (
        <span className="text-legal text-muted-foreground">{t("full")}</span>
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={inTicket}
          aria-label={`${inTicket ? t("inTicket") : t("add")} – ${leg.label}`}
          className={clsx(
            "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            inTicket
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-foreground hover:bg-muted",
          )}
        >
          {inTicket ? (
            <Check aria-hidden strokeWidth={2.5} className="size-4" />
          ) : (
            <Plus aria-hidden strokeWidth={2.5} className="size-4" />
          )}
        </button>
      )}
    </span>
  );
}
