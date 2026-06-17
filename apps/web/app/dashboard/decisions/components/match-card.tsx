import { Card, Separator } from "@evcore/ui";
import { translateCompetition } from "@/lib/competition-i18n";
import type {
  ChannelDecisionDto,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";
import { CHANNEL_ORDER } from "./channel-constants";
import { ChannelRow } from "./channel-row";

// All channel decisions for one fixture, keyed by channel.
export type MatchGroup = {
  fixtureId: string;
  fixture: string;
  competition: string | null;
  kickoff: string;
  byChannel: Map<StrategyChannel, ChannelDecisionDto>;
  selectedCount: number;
};

export function MatchCard({
  group,
  locale,
}: {
  group: MatchGroup;
  locale: string;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{group.fixture}</p>
          <p className="truncate text-xs text-muted-foreground">
            {group.competition
              ? translateCompetition(group.competition, locale)
              : "—"}
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {group.kickoff}
        </span>
      </div>

      <Separator />

      <div className="flex flex-col divide-y divide-border/60">
        {CHANNEL_ORDER.map((channel) => (
          <ChannelRow
            key={channel}
            channel={channel}
            decision={group.byChannel.get(channel)}
            locale={locale}
          />
        ))}
      </div>
    </Card>
  );
}
