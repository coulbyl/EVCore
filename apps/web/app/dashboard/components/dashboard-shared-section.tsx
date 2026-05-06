"use client";

import { useCompetitionStats } from "@/domains/dashboard/use-cases/get-competition-stats";
import { useLeaderboard } from "@/domains/dashboard/use-cases/get-leaderboard";
import { CompetitionRanking } from "./competition-ranking";
import { UserLeaderboard } from "./user-leaderboard";

export function DashboardSharedSection() {
  const { data: competitionStats } = useCompetitionStats();
  const { data: leaderboard } = useLeaderboard();

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <CompetitionRanking stats={competitionStats ?? []} />
      <UserLeaderboard entries={leaderboard ?? []} />
    </div>
  );
}
