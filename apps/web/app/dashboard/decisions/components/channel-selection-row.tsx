import { Card } from "@evcore/ui";
import { translateCompetition } from "@/lib/competition-i18n";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import type { ChannelDecisionDto } from "@/domains/channel-decision/types/channel-decision";
import { formatEv, formatOdds, formatPct } from "./channel-constants";
import { ResultBadge } from "./result-badge";

// One SELECTED decision rendered fixture-first (used by the "Par canal" lens).
export function ChannelSelectionRow({
  decision,
  locale,
}: {
  decision: ChannelDecisionDto;
  locale: string;
}) {
  const loc = locale === "en" ? "en" : "fr";
  const selection = decision.selections[0];
  if (selection === undefined) return null;

  return (
    <Card className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{decision.fixture}</p>
        <p className="truncate text-xs text-muted-foreground">
          {decision.competition
            ? translateCompetition(decision.competition, locale)
            : "—"}
          <span className="ml-1.5 tabular-nums">{decision.kickoff}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-xs">
        <span className="font-medium">
          {formatPickForDisplay(selection.pick, selection.market)}
          <span className="ml-1.5 text-muted-foreground">
            {formatMarketForDisplay(selection.market, loc)}
          </span>
        </span>
        <span className="tabular-nums text-muted-foreground">
          {formatPct(selection.probability)}
        </span>
        {formatOdds(selection.odds) !== null && (
          <span className="tabular-nums font-semibold">
            {formatOdds(selection.odds)}
          </span>
        )}
        {formatEv(selection.ev) !== null && (
          <span className="tabular-nums text-muted-foreground">
            {formatEv(selection.ev)}
          </span>
        )}
        <ResultBadge result={selection.result} />
      </div>
    </Card>
  );
}
