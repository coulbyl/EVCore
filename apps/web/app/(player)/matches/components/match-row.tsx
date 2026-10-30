import { ChanceFigure } from "@/components/scoreboard/ui/chance-figure";
import type { MatchItem, MatchReading } from "@/domains/matches/types/matches";
import { TeamMark } from "../../today/components/team-mark";
import { readingLabel } from "./matches-constants";

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
    <li className="flex min-h-14 items-center gap-3 py-2">
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

/** A match without a reading, unfolded: why, in grey (06 § 1). */
export function MatchWithoutReadingRow({
  item,
  meta,
  reason,
}: {
  item: MatchItem;
  meta: string;
  reason: string;
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 py-2 text-muted-foreground">
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
