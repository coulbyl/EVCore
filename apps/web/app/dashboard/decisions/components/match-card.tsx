import { Card, Separator } from "@evcore/ui";
import type {
  ChannelDecisionMatchDto,
  ChannelDecisionMatchDecisionDto,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";
import { CHANNEL_ORDER } from "./channel-constants";
import { ChannelRow } from "./channel-row";
import { FixtureHeading } from "./fixture-heading";

export type MatchGroup = ChannelDecisionMatchDto;

export function MatchCard({
  group,
  locale,
}: {
  group: MatchGroup;
  locale: string;
}) {
  function decisionForChannel(
    channel: StrategyChannel,
  ): ChannelDecisionMatchDecisionDto | undefined {
    return group.decisions.find((decision) => decision.channel === channel);
  }

  return (
    <Card className="gap-3 border-border/70 p-4 transition-colors hover:border-border">
      <div className="flex items-start justify-between gap-3">
        <FixtureHeading
          homeTeam={group.homeTeam}
          awayTeam={group.awayTeam}
          homeLogo={group.homeLogo}
          awayLogo={group.awayLogo}
          competition={group.competition}
          country={group.country}
          locale={locale}
          score={group.score}
          htScore={group.htScore}
        />
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs tabular-nums text-muted-foreground">
            {group.kickoff}
          </span>
          <span className="text-[0.65rem] font-medium tabular-nums text-muted-foreground">
            {group.selectedCount}/{CHANNEL_ORDER.length}
          </span>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col divide-y divide-border/50">
        {CHANNEL_ORDER.map((channel) => (
          <ChannelRow
            key={channel}
            channel={channel}
            decision={decisionForChannel(channel)}
            locale={locale}
          />
        ))}
      </div>
    </Card>
  );
}
