import type { ChannelDecisionMatchDto } from "@/domains/channel-decision/types/channel-decision";
import { MatchCard, type MatchGroup } from "./match-card";

export function MatchLens({
  matches,
  locale,
}: {
  matches: ChannelDecisionMatchDto[];
  locale: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {matches.map((group: MatchGroup) => (
        <MatchCard key={group.fixtureId} group={group} locale={locale} />
      ))}
    </div>
  );
}
