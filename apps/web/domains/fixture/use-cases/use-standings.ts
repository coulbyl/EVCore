"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

export type StandingTeam = {
  rank: number;
  teamApiId: number;
  teamName: string;
  teamLogo: string;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsDiff: number;
  points: number;
  form: string | null;
  description: string | null;
};

export type StandingGroup = {
  name: string;
  teams: StandingTeam[];
};

export type StandingsData = {
  competition: string;
  season: string;
  groups: StandingGroup[];
};

export function useStandings(competition: string, season: number) {
  return useQuery({
    queryKey: ["standings", competition, season],
    queryFn: () =>
      clientApiRequest<StandingsData>(
        `/standings?competition=${competition}&season=${season}`,
        { fallbackErrorMessage: "Impossible de charger les classements." },
      ),
    staleTime: 60 * 60_000, // 1h — standings don't change intra-day
    retry: 1,
  });
}
