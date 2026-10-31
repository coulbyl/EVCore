import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ResultMark } from "./result-mark";

export type YesterdayLead = {
  name: string;
  outcome: "won" | "lost" | "void" | "pending";
  /** The odds really paid, after a win. */
  odds?: string;
};

/**
 * « Hier » in the band (decided 31/10): the first product of the screen in
 * words with its ✓ ✗ — green won, red lost —, then the count, « 4 gagnés
 * sur 7 », and the sheet of yesterday's coupons on a tap, where every
 * product is named. The three-letter codes read as internal codes.
 */
export function YesterdaySummary({
  href,
  label,
  lead,
  count,
  outcomeLabels,
}: {
  href: string;
  /** « Hier », or « Hier vendredi 30 ». */
  label: React.ReactNode;
  lead: YesterdayLead;
  /** « 4 gagnés sur 7 », or null with a single product. */
  count: string | null;
  outcomeLabels: { won: string; lost: string; void: string };
}) {
  return (
    <Link
      href={href}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md focus-visible:outline-2 focus-visible:outline-led-on"
    >
      <span className="text-meta text-band-muted">{label}</span>
      <span className="flex items-center gap-1.5 text-body font-medium">
        {lead.name}
        {lead.outcome !== "pending" ? (
          <ResultMark
            kind={lead.outcome}
            tone="band"
            size="sm"
            label={outcomeLabels[lead.outcome]}
          />
        ) : null}
        {lead.odds ? (
          <span className="score text-bet font-semibold">{lead.odds}</span>
        ) : null}
      </span>
      {count ? (
        <span className="text-body text-band-muted">· {count}</span>
      ) : null}
      <ChevronRight
        aria-hidden
        strokeWidth={2}
        className="ms-auto size-[1.125rem] text-band-muted"
      />
    </Link>
  );
}
