"use client";

import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { clsx } from "clsx";
import {
  chanceOf,
  formatOdds,
  formatWeekdayDay,
  type DisplayLocale,
} from "@/helpers/scoreboard-format";
import { TeamMark } from "@/app/(player)/today/components/team-mark";
import { usePlayerText } from "../text/player-texts";
import { clearTicket, ticketOutcome } from "./ticket-store";
import type { TicketLeg, TicketQuote, TicketTotals } from "./ticket-types";

export type YesterdayTicketData = {
  legs: TicketLeg[];
  quote: TicketQuote | null;
  /** The whole ticket's figures before its first match, if seen. */
  totals: TicketTotals | null;
  /** Its last match's day, YYYY-MM-DD. */
  day: string;
};

const MARKS = {
  won: { Icon: Check, className: "text-win" },
  lost: { Icon: X, className: "text-loss" },
  void: { Icon: Minus, className: "text-muted-foreground" },
} as const;

/**
 * « Ton ticket d'hier » (07 § 6, maquette TicketHier), shown once, settled:
 * « perdu · il fallait les 4 » or « gagné · 1 fois sur 46, c'était
 * celle-là », never how many passed (« 5 sur 8 » feeds the near miss),
 * then its matches with their score and mark, our hero of that day to
 * compare, and « Composer celui d'aujourd'hui ».
 */
export function YesterdayTicket({
  ticket,
  locale,
}: {
  ticket: YesterdayTicketData;
  locale: DisplayLocale;
}) {
  const t = usePlayerText("ticket");
  const short = usePlayerText("today.shortNames");
  const { quote, totals } = ticket;
  const settled = quote ? ticketOutcome(quote) : null;
  const outcome = settled?.outcome ?? "pending";
  const chance = totals ? chanceOf(totals.chance) : null;
  const legs = [...ticket.legs].sort((a, b) =>
    a.kickoffAt.localeCompare(b.kickoffAt),
  );
  const hero = quote?.hero ?? null;
  const heroMark =
    hero && hero.state in MARKS
      ? MARKS[hero.state as keyof typeof MARKS]
      : null;

  const meta = [
    formatWeekdayDay(new Date(`${ticket.day}T12:00:00Z`), locale, "UTC"),
    legs.length === 1
      ? t("matchOne")
      : t("matchMany", { count: String(legs.length) }),
    totals ? t("oddsOf", { odds: formatOdds(totals.odds, locale) }) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col">
      <h3 className="score text-title font-semibold">{t("yesterdayTitle")}</h3>
      <p className="text-meta text-muted-foreground">{meta.join(" · ")}</p>

      <div className="mt-4 flex flex-col gap-1" aria-live="polite">
        <p
          className={clsx(
            "score flex items-center gap-2 text-figure font-bold",
            outcome === "won" && "text-win",
            outcome === "lost" && "text-loss",
          )}
        >
          {outcome in MARKS
            ? (() => {
                const { Icon } = MARKS[outcome as keyof typeof MARKS];
                return <Icon aria-hidden strokeWidth={3} className="size-7" />;
              })()
            : null}
          {t(outcome === "pending" ? "outcomePending" : outcome)}
        </p>
        {outcome === "lost" && settled ? (
          <p className="text-body text-muted-foreground">
            {t("neededAll", { count: String(settled.needed) })}
          </p>
        ) : null}
        {outcome === "won" && chance?.kind === "oneIn" ? (
          <p className="text-body text-muted-foreground">
            {t("wasTheOne", { total: String(chance.total) })}
          </p>
        ) : null}
      </div>

      <ul className="mt-4 divide-y divide-border border-y border-border">
        {legs.map((leg) => {
          const priced = quote?.legs.find((q) => q.fixtureId === leg.fixtureId);
          const mark = priced?.result ? MARKS[priced.result] : null;
          return (
            <li
              key={leg.fixtureId}
              className="flex min-h-14 items-center gap-2.5 py-1.5"
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
              <span className="score shrink-0 text-bet font-semibold">
                {priced?.score
                  ? `${priced.score.home}–${priced.score.away}`
                  : priced?.result === "void"
                    ? t("postponed")
                    : null}
              </span>
              {mark ? (
                <mark.Icon
                  role="img"
                  aria-label={t(priced?.result ?? "outcomePending")}
                  strokeWidth={3}
                  className={clsx("size-5 shrink-0", mark.className)}
                />
              ) : (
                <span className="size-5 shrink-0" />
              )}
            </li>
          );
        })}
      </ul>

      {hero ? (
        <Link
          href="/results"
          className="flex min-h-13 flex-wrap items-center gap-x-2 border-b border-border py-2 text-body focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <span className="font-medium">
            {t("oursYesterday", { product: short(hero.product) })}
          </span>
          {heroMark ? (
            <heroMark.Icon
              role="img"
              aria-label={t(hero.state as "won" | "lost" | "void")}
              strokeWidth={3}
              className={clsx("size-4", heroMark.className)}
            />
          ) : null}
          <span className="text-muted-foreground">
            {[
              hero.match
                ? `${hero.match.home} – ${hero.match.away}${
                    hero.match.score
                      ? ` ${hero.match.score.home}–${hero.match.score.away}`
                      : ""
                  }`
                : null,
              hero.odds !== null ? formatOdds(hero.odds, locale) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </Link>
      ) : null}

      <Link
        href="/matches"
        onClick={clearTicket}
        className="mt-5 inline-flex min-h-12 items-center justify-center rounded-[0.625rem] bg-primary px-4 text-bet font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t("composeToday")}
      </Link>
    </div>
  );
}
