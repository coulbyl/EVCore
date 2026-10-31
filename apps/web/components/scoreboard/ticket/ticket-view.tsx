"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { clsx } from "clsx";
import {
  chanceOf,
  formatOdds,
  formatShare,
  formatShortDate,
  formatTime,
  ledsOf,
  type DisplayLocale,
} from "@/helpers/scoreboard-format";
import { TeamMark } from "@/app/(player)/today/components/team-mark";
import { HelpHint } from "../ui/help-hint";
import { useOnline } from "../states/use-online";
import { usePlayerText } from "../text/player-texts";
import { needsCount, quoteTicket } from "./quote-ticket";
import {
  acknowledgeMoves,
  checkedTotals,
  clearTicket,
  currentQuote,
  pastTicketDay,
  removeFromTicket,
  ticketOutcome,
  ticketSnapshot,
} from "./ticket-store";
import { YesterdayTicket, type YesterdayTicketData } from "./ticket-yesterday";
import { TicketChance } from "./ticket-chance";
import type {
  TicketLeg,
  TicketQuote,
  TicketQuoteLeg,
  TicketTotals,
} from "./ticket-types";
import { useTicket } from "./use-ticket";

/**
 * « Mon ticket » opened (07 § 3, maquette Ticket): the count and « Vider »,
 * the bets in kick-off order, compact for 15 (the bet in bold, the match
 * under it, the price, a cross), then our coupon of the day to compare. The
 * figures sit in the fixed footer (TicketFooter). Opening it prices the ticket again (07 § 6: odds brought up to
 * date, « cote mise à jour » past 5 %), and counts it once a day.
 */
export function TicketView({ locale }: { locale: DisplayLocale }) {
  const t = usePlayerText("ticket");
  const products = usePlayerText("today.products");
  const online = useOnline();
  const ticket = useTicket();
  const [status, setStatus] = useState<"idle" | "pending" | "failed">("idle");
  const count = ticket.legs.length;

  // « Cote mise à jour » is said once: the sheet takes the moved bets out
  // of the store on opening and shows them while it stays open. Once per
  // opening, React's double mount in development included.
  const [moved, setMoved] = useState<ReadonlySet<string>>(new Set());
  const taken = useRef(false);
  const takeMoves = () => {
    const ids = ticketSnapshot()
      .legs.filter((leg) => leg.oddsMoved)
      .map((leg) => leg.fixtureId);
    if (ids.length === 0) return;
    setMoved((shown) => new Set([...shown, ...ids]));
    acknowledgeMoves();
  };
  useEffect(() => {
    if (taken.current) return;
    taken.current = true;
    takeMoves();
    // On opening only.
  }, []);

  // The ticket of yesterday (07 § 6): shown once settled, then emptied.
  // The sheet keeps what it shows until it closes; React's double mount in
  // development included.
  const past = pastTicketDay(ticket.legs);
  const quote = currentQuote(ticket);
  const [settled, setSettled] = useState<YesterdayTicketData | null>(null);
  const emptied = useRef(false);
  useEffect(() => {
    if (!past || !quote || emptied.current) return;
    if (ticketOutcome(quote).outcome === "pending") return;
    emptied.current = true;
    setSettled({
      legs: ticket.legs,
      quote,
      totals: checkedTotals(ticket),
      day: past,
    });
    clearTicket();
  }, [past, quote, ticket]);

  // Once per opening, then again when the ticket changes in the sheet.
  const key = ticket.legs.map((leg) => leg.fixtureId).join(",");
  useEffect(() => {
    if (count === 0 || !online) return;
    let live = true;
    setStatus("pending");
    quoteTicket(ticket.legs, {
      verify: !past && needsCount(ticket, new Date()),
      day: past,
    })
      .then(() => {
        takeMoves();
        if (live) setStatus("idle");
      })
      .catch(() => live && setStatus("failed"));
    return () => {
      live = false;
    };
    // The composition decides, not each new snapshot of the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, online]);

  if (settled) return <YesterdayTicket ticket={settled} locale={locale} />;
  if (past) {
    return (
      <YesterdayTicket
        ticket={{
          legs: ticket.legs,
          quote,
          totals: checkedTotals(ticket),
          day: past,
        }}
        locale={locale}
      />
    );
  }

  if (count === 0) {
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="text-body">{t("empty")}</p>
        <Link
          href="/matches"
          className="inline-flex min-h-11 items-center rounded-[0.625rem] border border-primary px-4 text-body font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("seeMatches")}
        </Link>
      </div>
    );
  }

  const legs = [...ticket.legs].sort((a, b) =>
    a.kickoffAt.localeCompare(b.kickoffAt),
  );
  const hero = quote?.hero ?? null;

  return (
    <div className="flex flex-col">
      {/* The count and « Vider » stay above the list (bet slips' habit). */}
      <div className="-mt-1 flex min-h-10 items-center justify-between gap-3">
        <span className="text-meta font-medium text-muted-foreground">
          {count === 1
            ? t("matchOne")
            : t("matchMany", { count: String(count) })}
        </span>
        <button
          type="button"
          onClick={clearTicket}
          className="-me-2 min-h-10 rounded-md px-2 text-meta font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {t("clear")}
        </button>
      </div>

      <ul className="divide-y divide-border border-y border-border">
        {legs.map((leg) => (
          <LegRow
            key={leg.fixtureId}
            leg={leg}
            priced={quote?.legs.find((q) => q.fixtureId === leg.fixtureId)}
            moved={moved.has(leg.fixtureId)}
            locale={locale}
          />
        ))}
      </ul>

      {status === "failed" && !quote ? (
        <p role="alert" className="pt-3 text-body">
          {t("failed")}
        </p>
      ) : null}

      {hero ? (
        <Link
          href={`/today/coupon/${hero.couponId}`}
          className="mt-3 flex min-h-13 items-center gap-3 border-b border-border text-body font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <span className="flex-1">
            {t("ours", { product: products(hero.product) })}
          </span>
          {hero.chance !== null ? (
            <TicketChance
              probability={hero.chance}
              phrasing="short"
              showLeds={false}
              tone="surface"
              className="text-bet"
            />
          ) : null}
          <ChevronRight
            aria-hidden
            strokeWidth={2}
            className="size-[1.125rem] shrink-0 text-icon-subtle"
          />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * One bet: logos, teams, the bet named with its team, its 1xBet price and
 * a cross. Kick-off passed: grey, « Commencé », out of the figures.
 */
function LegRow({
  leg,
  priced,
  moved,
  locale,
}: {
  leg: TicketLeg;
  priced: TicketQuoteLeg | undefined;
  /** « cote mise à jour », once (07 § 6). */
  moved: boolean;
  locale: DisplayLocale;
}) {
  const t = usePlayerText("ticket");
  const started =
    priced?.state === "started" ||
    new Date(leg.kickoffAt).getTime() <= Date.now();
  const aside = started
    ? t("started")
    : priced?.state === "postponed"
      ? t("postponed")
      : priced && priced.odds === null
        ? t("notPriced")
        : null;
  return (
    <li
      className={clsx(
        "flex min-h-14 items-center gap-2.5 py-1.5",
        aside && "text-muted-foreground",
      )}
    >
      <span className="flex shrink-0 items-center">
        <TeamMark team={leg.home} />
        <span className="-ms-2.5 rounded-full ring-2 ring-card">
          <TeamMark team={leg.away} />
        </span>
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-body font-semibold">
          {leg.label}
        </span>
        <span className="block truncate text-meta text-muted-foreground">
          {leg.home.name} – {leg.away.name}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span
          className={clsx(
            "score font-semibold",
            aside ? "text-meta" : "text-bet",
          )}
        >
          {aside ?? formatOdds(leg.odds, locale)}
        </span>
        {moved && !aside ? (
          <span className="text-legal text-muted-foreground">
            {t("oddsUpdated")}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={() => removeFromTicket(leg.fixtureId)}
        aria-label={t("remove", { bet: leg.label })}
        className="-me-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <X aria-hidden strokeWidth={2} className="size-[1.125rem]" />
      </button>
    </li>
  );
}

/**
 * The summary fixed at the bottom of the sheet, visible while the list of
 * up to 15 bets scrolls (bet slips' habit): the total odds, the chance with
 * its diodes, what 1xBet keeps over time. « Partager mes chances » joins it
 * in C8.
 */
export function TicketFooter({
  locale,
  timeZone,
}: {
  locale: DisplayLocale;
  timeZone: string;
}) {
  const t = usePlayerText("ticket");
  const online = useOnline();
  const ticket = useTicket();
  // Yesterday's ticket has its own way out (« Composer celui d'aujourd'hui »).
  if (ticket.legs.length === 0 || pastTicketDay(ticket.legs)) return null;
  const quote = currentQuote(ticket);
  const totals = quote?.totals ?? null;
  if (!quote || !totals) {
    return (
      <p aria-live="polite" className="text-body text-muted-foreground">
        {t("pending")}
      </p>
    );
  }
  return (
    <section aria-live="polite" className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-4">
        <p className="flex flex-col">
          <span className="text-meta text-muted-foreground">
            {t("totalOdds")}
          </span>
          <span className="score text-figure font-bold">
            {formatOdds(totals.odds, locale)}
          </span>
        </p>
        <p className="flex flex-col items-end gap-1 text-end">
          <span className="text-meta text-muted-foreground">
            {t("yourChances")}
          </span>
          <TicketChance
            probability={totals.chance}
            phrasing={totals.legCount === 1 ? "short" : "about"}
            tone="surface"
            className="flex flex-col items-end gap-1.5 text-title"
          />
        </p>
      </div>
      <p className="text-meta text-muted-foreground">
        {t(totals.legCount === 1 ? "keepBet" : "keepTicket", {
          share: formatShare(totals.keep, locale),
        })}
        <HelpHint slug="what-1xbet-keeps" label={t("helpKeep")} />
        {!online ? (
          <>
            {" · "}
            {t("oddsAt", {
              time: formatTime(new Date(quote.quotedAt), locale, timeZone),
            })}
          </>
        ) : null}
      </p>
      <ShareButton
        legs={ticket.legs}
        quote={quote}
        totals={totals}
        locale={locale}
        timeZone={timeZone}
      />
    </section>
  );
}

/**
 * « Partager mes chances » (07 § 5): the image of the ticket, drawn on the
 * tap only (its code loads then), shared through the phone or downloaded.
 * The bets still to come, as the figures count them.
 */
function ShareButton({
  legs,
  quote,
  totals,
  locale,
  timeZone,
}: {
  legs: readonly TicketLeg[];
  quote: TicketQuote;
  totals: TicketTotals;
  locale: DisplayLocale;
  timeZone: string;
}) {
  const t = usePlayerText("ticket");
  const chanceText = usePlayerText("scoreboard.chance");
  const products = usePlayerText("today.products");
  const shell = usePlayerText("shell");
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function share() {
    setState("busy");
    const open = new Set(
      quote.legs.filter((l) => l.state === "open").map((l) => l.fixtureId),
    );
    const chance = chanceOf(totals.chance);
    const single = totals.legCount === 1;
    const words = !chance
      ? ""
      : chance.kind === "outOfTen"
        ? chanceText("outOfTen", {
            count: String(chance.count),
            total: String(chance.total),
          })
        : chance.kind === "oneIn"
          ? t("imageChance", { total: String(chance.total) })
          : chanceText("aboutRarerThan", { total: String(chance.total) });
    const hero = quote.hero;
    const heroChance = hero?.chance != null ? chanceOf(hero.chance) : null;
    try {
      const { shareTicketImage } = await import("./share-image");
      await shareTicketImage(
        {
          title: "EVCore",
          date: t("imageDate", {
            date: formatShortDate(new Date(), locale, timeZone),
          }),
          legs: [...legs]
            .filter((leg) => open.has(leg.fixtureId))
            .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
            .map((leg) => ({
              teams: `${leg.home.name} – ${leg.away.name}`,
              label: leg.label,
              odds: formatOdds(leg.odds, locale),
            })),
          totalOddsLabel: t("totalOdds"),
          totalOdds: formatOdds(totals.odds, locale),
          about: single || chance?.kind === "rarerThan" ? "" : t("imageAbout"),
          chance: words,
          leds: chance ? ledsOf(chance) : null,
          keep: single
            ? t("keepBet", { share: formatShare(totals.keep, locale) })
            : t("imageKeep", { share: formatShare(totals.keep, locale) }),
          ours:
            hero && heroChance?.kind === "outOfTen"
              ? `${t("imageOurs", {
                  product: products(hero.product),
                  chance: chanceText("outOfTen", {
                    count: String(heroChance.count),
                    total: String(heroChance.total),
                  }),
                })} · evcore.app`
              : "evcore.app",
          legal: shell("legal"),
        },
        "evcore-ticket.png",
      );
      setState("idle");
    } catch (error) {
      // Closing the phone's share sheet is not a failure.
      setState(
        error instanceof DOMException && error.name === "AbortError"
          ? "idle"
          : "failed",
      );
    }
  }

  return (
    <div className="flex flex-col gap-1 pt-1">
      <button
        type="button"
        onClick={share}
        disabled={state === "busy"}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-[0.625rem] bg-primary text-bet font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
      >
        {t("share")}
      </button>
      {state === "failed" ? (
        <p role="alert" className="text-meta">
          {t("shareFailed")}
        </p>
      ) : null}
    </div>
  );
}
