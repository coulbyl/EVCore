"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

export type PredictionItem = {
  id: string;
  fixtureId: string;
  competition: string;
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

function fetchPredictions(date: string): Promise<PredictionItem[]> {
  return clientApiRequest<PredictionItem[]>(`/predictions?date=${date}`, {
    fallbackErrorMessage: "Impossible de charger les prédictions.",
  });
}

function fetchPredictionStats(
  from: string,
  to: string,
): Promise<PredictionStatsResult> {
  return clientApiRequest<PredictionStatsResult>(
    `/predictions/stats?from=${from}&to=${to}`,
    { fallbackErrorMessage: "Impossible de charger les stats prédictions." },
  );
}

export function usePredictions(date: string) {
  return useQuery({
    queryKey: ["predictions", date],
    queryFn: () => fetchPredictions(date),
    refetchInterval: 60_000,
  });
}

export function usePredictionStats(from: string, to: string) {
  return useQuery({
    queryKey: ["prediction-stats", from, to],
    queryFn: () => fetchPredictionStats(from, to),
    staleTime: 5 * 60_000,
  });
}
