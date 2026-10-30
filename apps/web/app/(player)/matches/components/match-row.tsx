import { ChanceFigure } from "@/components/scoreboard/ui/chance-figure";
import { ResultMark } from "@/components/scoreboard/ui/result-mark";
import type { MatchItem, MatchReading } from "@/domains/matches/types/matches";
import { TeamMark } from "../../today/components/team-mark";
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
 * competition, one reading on the right, « Victoire Arsenal · 7 sur 10 ».
 * One figure: the chance.
 */
export function MatchRow({
  item,
}: {
  item: MatchItem & { reading: MatchReading };
}) {
  return (
    <li
      data-search={searchOf(item)}
      className="flex min-h-14 items-center gap-3 py-2"
    >
      <TeamPair item={item} />
      <MatchTitle item={item} />
      <span className="flex max-w-[48%] shrink-0 flex-wrap items-baseline justify-end gap-x-1.5 text-end text-body">
        <span>{readingLabel(item)} ·</span>
        <ChanceFigure
          probability={item.reading.chance}
          showLeds={false}
          size="sm"
        />
      </span>
    </li>
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
    <li
      data-search={searchOf(item)}
      className="flex min-h-14 items-center gap-3 py-2"
    >
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
      <MatchTitle
        item={item}
        meta={postponed ? labels.postponedMeta : undefined}
      />
      {refunded ? (
        <span className="shrink-0 text-body text-muted-foreground">
          {labels.refunded}
        </span>
      ) : (
        <span className="flex max-w-[48%] shrink-0 items-center justify-end gap-2 text-end text-body">
          {readingLabel(item)}
          {item.reading.result === "won" || item.reading.result === "lost" ? (
            <ResultMark
              kind={item.reading.result}
              label={labels[item.reading.result]}
            />
          ) : null}
        </span>
      )}
    </li>
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
    <li
      data-search={searchOf(item)}
      className="flex min-h-14 items-center gap-3 py-2 text-muted-foreground"
    >
      <TeamPair item={item} />
      <MatchTitle item={item} meta={meta} muted />
      <span className="shrink-0 text-end text-body">{reason}</span>
    </li>
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
