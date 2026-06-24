import { Card } from "@evcore/ui";
import { useTranslations } from "next-intl";
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
  reasonLabel,
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
  const t = useTranslations("decisions");
  const selection = decision.selections[0];

  return (
    <Card className="relative flex-col items-stretch gap-2 overflow-hidden border-border/70 p-3 pl-4 transition-colors hover:border-border sm:flex-row sm:items-center sm:justify-between sm:gap-3">
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

      {selection === undefined ? (
        // Negative decision (e.g. AVOID): no pick — show why the fixture is flagged.
        <span className="text-xs text-muted-foreground sm:shrink-0">
          {reasonLabel(decision.reasonCode, t) ?? "—"}
        </span>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:shrink-0 sm:justify-end">
          <span className="min-w-0 font-medium">
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
      )}
    </Card>
  );
}
