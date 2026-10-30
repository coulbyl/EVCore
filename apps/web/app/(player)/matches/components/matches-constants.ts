import { formatLinePick, formatPickWithTeams } from "@/helpers/fixture";
import { formatTime, type DisplayLocale } from "@/helpers/scoreboard-format";
import {
  MATCHES_DAYS,
  type MatchItem,
  type MatchReading,
  type MatchesDay,
} from "@/domains/matches/types/matches";

/** The day chip of the address, Aujourd'hui when absent or unknown. */
export function dayOf(param: string | string[] | undefined): MatchesDay {
  const value = Array.isArray(param) ? param[0] : param;
  return MATCHES_DAYS.find((day) => day === value) ?? "today";
}

/** The team search sent with Enter (`?q=`), as the API takes it. */
export function queryOf(param: string | string[] | undefined): string {
  const value = Array.isArray(param) ? param[0] : param;
  return (value ?? "").trim().slice(0, 40);
}

export function dayHref(day: MatchesDay): string {
  return day === "today" ? "/matches" : `/matches?day=${day}`;
}

/** A bet named with its team: « Victoire Arsenal », « Plus de 2,5 buts ». */
export function pickLabel(
  bet: { market: string; pick: string },
  teams: { home: { name: string }; away: { name: string } },
): string {
  return (
    formatLinePick(bet.pick, bet.market, null) ??
    formatPickWithTeams(bet.pick, bet.market, {
      home: teams.home.name,
      away: teams.away.name,
    })
  );
}

/** The reading of a row of the list. */
export function readingLabel(
  item: MatchItem & { reading: MatchReading },
): string {
  return pickLabel(item.reading, item);
}

export type HourGroup<T extends MatchItem> = { time: string; items: T[] };

/**
 * The matches with a reading under their kick-off time (06 § 1), in the
 * server's order: time, then the big competitions, then the alphabet.
 */
export function hourGroups<T extends MatchItem>(
  items: readonly T[],
  locale: DisplayLocale,
  timeZone: string,
): HourGroup<T>[] {
  const groups: HourGroup<T>[] = [];
  for (const item of items) {
    const time = formatTime(new Date(item.kickoffAt), locale, timeZone);
    const last = groups.at(-1);
    if (last?.time === time) last.items.push(item);
    else groups.push({ time, items: [item] });
  }
  return groups;
}

export function hasReading(
  item: MatchItem,
): item is MatchItem & { reading: MatchReading } {
  return item.reading !== null;
}
