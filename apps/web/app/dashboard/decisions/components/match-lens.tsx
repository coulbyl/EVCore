import type {
  ChannelDecisionDto,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";
import { MatchCard, type MatchGroup } from "./match-card";

// Group decisions by fixture, preserving the backend ordering (scheduledAt asc).
export function groupByFixture(
  decisions: ChannelDecisionDto[],
): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();
  for (const decision of decisions) {
    let group = groups.get(decision.fixtureId);
    if (group === undefined) {
      group = {
        fixtureId: decision.fixtureId,
        homeTeam: decision.homeTeam,
        awayTeam: decision.awayTeam,
        homeLogo: decision.homeLogo,
        awayLogo: decision.awayLogo,
        competition: decision.competition,
        country: decision.country,
        kickoff: decision.kickoff,
        score: decision.score,
        htScore: decision.htScore,
        byChannel: new Map<StrategyChannel, ChannelDecisionDto>(),
        selectedCount: 0,
      };
      groups.set(decision.fixtureId, group);
    }
    group.byChannel.set(decision.channel, decision);
    if (decision.status === "SELECTED") group.selectedCount += 1;
  }
  return [...groups.values()];
}

export function MatchLens({
  decisions,
  locale,
}: {
  decisions: ChannelDecisionDto[];
  locale: string;
}) {
  const groups = groupByFixture(decisions);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <MatchCard key={group.fixtureId} group={group} locale={locale} />
      ))}
    </div>
  );
}
