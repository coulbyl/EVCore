"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { FixturePrediction } from "@/domains/fixture/types/fixture";

export type PredictionItem = {
  id: string;
  fixtureId: string;
  competition: string;
  channel: FixturePrediction["channel"];
  fixture: string;
  kickoff: string;
  market: string;
  pick: string;
  probability: string;
  correct: boolean | null;
};

export type PredictionStatsResult = {
  total: number;
  correct: number;
  hitRate: string;
  byCompetition: {
    competition: string;
    total: number;
    correct: number;
    hitRate: string;
  }[];
};

function fetchPredictions(
  date: string,
  channel?: FixturePrediction["channel"],
): Promise<PredictionItem[]> {
  const params = new URLSearchParams({ date });
  if (channel) params.set("channel", channel);
  return clientApiRequest<PredictionItem[]>(
    `/predictions?${params.toString()}`,
    {
      fallbackErrorMessage: "Impossible de charger les prédictions.",
    },
  );
}

function fetchPredictionStats(
  from: string,
  to: string,
  channel?: FixturePrediction["channel"],
): Promise<PredictionStatsResult> {
  const params = new URLSearchParams({ from, to });
  if (channel) params.set("channel", channel);
  return clientApiRequest<PredictionStatsResult>(
    `/predictions/stats?${params.toString()}`,
    { fallbackErrorMessage: "Impossible de charger les stats prédictions." },
  );
}

export function usePredictions(
  date: string,
  channel?: FixturePrediction["channel"],
) {
  return useQuery({
    queryKey: ["predictions", date, channel ?? "ALL"],
    queryFn: () => fetchPredictions(date, channel),
    refetchInterval: 60_000,
  });
}

export function usePredictionStats(
  from: string,
  to: string,
  channel?: FixturePrediction["channel"],
) {
  return useQuery({
    queryKey: ["prediction-stats", from, to, channel ?? "ALL"],
    queryFn: () => fetchPredictionStats(from, to, channel),
    staleTime: 5 * 60_000,
  });
}
