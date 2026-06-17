import { Card } from "@evcore/ui";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import type { ChannelDecisionDto } from "@/domains/channel-decision/types/channel-decision";
import {
  CHANNEL_COLOR,
  formatEv,
  formatOdds,
  formatPct,
} from "./channel-constants";
import { FixtureHeading } from "./fixture-heading";
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
    <Card className="relative flex-row items-center justify-between gap-3 overflow-hidden border-border/70 p-3 pl-4 transition-colors hover:border-border">
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: CHANNEL_COLOR[decision.channel] }}
        aria-hidden
      />
      <FixtureHeading
        homeTeam={decision.homeTeam}
        awayTeam={decision.awayTeam}
        homeLogo={decision.homeLogo}
        awayLogo={decision.awayLogo}
        competition={decision.competition}
        country={decision.country}
        locale={locale}
        kickoff={decision.kickoff}
        score={decision.score}
        htScore={decision.htScore}
      />

      <div className="flex shrink-0 items-center gap-3 text-xs">
        <span className="font-medium">
          {formatPickForDisplay(selection.pick, selection.market)}
          <span className="ml-1.5 font-normal text-muted-foreground">
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
