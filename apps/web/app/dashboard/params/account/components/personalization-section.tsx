import { FollowedLeaguesCard } from "./followed-leagues-card";
import { FollowedChannelsCard } from "./followed-channels-card";
import { RiskProfileCard } from "./risk-profile-card";

export function PersonalizationSection() {
  return (
    <div className="flex flex-col gap-4">
      <FollowedLeaguesCard />
      <FollowedChannelsCard />
      <RiskProfileCard />
    </div>
  );
}
