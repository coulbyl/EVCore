import Link from "next/link";
import { ChevronRight, TicketCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ResultMark } from "@/components/scoreboard/ui/result-mark";
import type { MatchItem, MatchReading } from "@/domains/matches/types/matches";
import { TeamMark } from "../../today/components/team-mark";
import { formatOdds, type DisplayLocale } from "@/helpers/scoreboard-format";
import { readingLabel } from "./matches-constants";
import { searchKey } from "./search-key";

/** What the team search compares (search-box.tsx). */
function searchOf(item: MatchItem): string {
  return searchKey(
    [
      item.home.name,
      item.away.name,
      item.home.shortName,
      item.away.shortName,
    ].join(" "),
  );
}

/**
 * One match (06 § 1, maquette Matchs): the two logos, the two teams and the
 * competition, one reading on the right, « Victoire Arsenal · 1,45 · 7 sur
 * 10 »: the 1xBet odds the player will look for, then the chance.
 */
export function MatchRow({
  item,
  locale,
}: {
  item: MatchItem & { reading: MatchReading };
  locale: DisplayLocale;
}) {
  return (
    <MatchLink item={item}>
      <TeamPair item={item} />
      <RowBody
        title={<MatchTitle item={item} />}
        side={
          <>
            <span className="min-w-0">{readingLabel(item)}</span>
            {/* The odds alone: the chance is told on the sheet. */}
            <span className="score shrink-0 text-bet font-semibold whitespace-nowrap">
              {formatOdds(item.reading.odds, locale)}
            </span>
          </>
        }
      />
    </MatchLink>
  );
}

/**
 * A match of yesterday (06 § 1 « Hier », maquette MatchsHier): the score in
 * place of the logos, the reading with its mark, ✓ or ✗, no chance. A
 * postponed match: « Rep. », « reporté » under the competition, its reading
 * « Remboursé » in grey.
 */
export function SettledMatchRow({
  item,
  labels,
}: {
  item: MatchItem & { reading: MatchReading };
  labels: {
    won: string;
    lost: string;
    refunded: string;
    postponedShort: string;
    postponedMeta: string;
  };
}) {
  const postponed = item.state === "postponed";
  const refunded = postponed || item.reading.result === "void";
  return (
    <MatchLink item={item}>
      <span
        className={
          postponed
            ? "w-12 shrink-0 text-center text-meta font-medium text-muted-foreground"
            : "score w-12 shrink-0 text-center text-title font-bold"
        }
      >
        {postponed
          ? labels.postponedShort
          : item.score
            ? `${item.score.home}–${item.score.away}`
            : "–"}
      </span>
      <RowBody
        title={
          <MatchTitle
            item={item}
            meta={postponed ? labels.postponedMeta : undefined}
          />
        }
        side={
          refunded ? (
            <span className="text-muted-foreground">{labels.refunded}</span>
          ) : (
            <>
              <span>{readingLabel(item)}</span>
              {item.reading.result === "won" ||
              item.reading.result === "lost" ? (
                <ResultMark
                  kind={item.reading.result}
                  label={labels[item.reading.result]}
                />
              ) : null}
            </>
          )
        }
      />
    </MatchLink>
  );
}

/**
 * A match without a reading, in grey: why (06 § 1). Folded at the bottom of
 * the day, or in its hour for tomorrow's « Lecture ce soir ».
 */
export function MatchWithoutReadingRow({
  item,
  meta,
  reason,
}: {
  item: MatchItem;
  meta?: string;
  reason: string;
}) {
  return (
    <MatchLink item={item} muted>
      <TeamPair item={item} />
      <RowBody
        title={<MatchTitle item={item} meta={meta} muted />}
        side={<span>{reason}</span>}
      />
    </MatchLink>
  );
}

/**
 * A row opens the match sheet (06 § 2), a set-aside match too (06 § 4: its
 * other bets stay). Its ticket mark (maquette MatchsTicket) is shown by a style
 * the ticket dock writes from the device's ticket.
 */
async function MatchLink({
  item,
  muted = false,
  children,
}: {
  item: MatchItem;
  muted?: boolean;
  children: React.ReactNode;
}) {
  const t = await getTranslations("ticket");
  return (
    <li data-search={searchOf(item)}>
      <Link
        href={`/matches/${item.fixtureId}`}
        className={
          (muted ? "text-muted-foreground " : "") +
          "-mx-2 flex min-h-14 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        }
      >
        {children}
        {/* Shown by a style of the ticket dock when the match is in « Mon
            ticket » (ticket-dock.tsx). */}
        <span
          data-ticket-mark={item.fixtureId}
          role="img"
          aria-label={t("inTicket")}
          className="hidden shrink-0 text-led-on-edge"
        >
          <TicketCheck
            aria-hidden
            strokeWidth={2}
            className="size-[1.125rem]"
          />
        </span>
        <ChevronRight
          aria-hidden
          strokeWidth={2}
          className="size-[1.125rem] shrink-0 text-icon-subtle"
        />
      </Link>
    </li>
  );
}

/**
 * The teams, then the reading. On a phone the reading goes under the teams,
 * its figure on the right: three columns in 375 px wrapped both into three
 * lines. From 640 px, side by side on one line. One element either way.
 */
function RowBody({
  title,
  side,
}: {
  title: React.ReactNode;
  side: React.ReactNode;
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      {title}
      <span className="flex items-center justify-between gap-x-3 text-body sm:max-w-[48%] sm:shrink-0 sm:justify-end sm:text-end">
        {side}
      </span>
    </span>
  );
}

function TeamPair({ item }: { item: MatchItem }) {
  return (
    <span className="flex shrink-0 items-center">
      <TeamMark team={item.home} lazy />
      <span className="-ms-2 rounded-full ring-2 ring-background">
        <TeamMark team={item.away} lazy />
      </span>
    </span>
  );
}

function MatchTitle({
  item,
  meta = item.competition.name,
  muted = false,
}: {
  item: MatchItem;
  meta?: string;
  muted?: boolean;
}) {
  return (
    <span className="min-w-0 flex-1">
      <span
        className={muted ? "block text-body" : "block text-body font-medium"}
      >
        {item.home.name} – {item.away.name}
      </span>
      <span className="block text-meta text-muted-foreground">{meta}</span>
    </span>
  );
}
