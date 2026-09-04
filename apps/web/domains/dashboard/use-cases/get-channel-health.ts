"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  ChannelCompetitionStatItem,
  ChannelHealthItem,
  ChannelStatsItem,
} from "../types/dashboard";

export function useChannelHealth(from: string, to: string) {
  return useQuery({
    queryKey: ["channel-health", from, to],
    queryFn: () =>
      clientApiRequest<ChannelHealthItem[]>(
        `/dashboard/channel-health?from=${from}&to=${to}`,
        { fallbackErrorMessage: "Impossible de charger la santé des canaux." },
      ),
    refetchInterval: 60_000,
  });
}

export function useChannelStats(from: string, to: string) {
  return useQuery({
    queryKey: ["channel-stats", from, to],
    queryFn: () =>
      clientApiRequest<ChannelStatsItem[]>(
        `/dashboard/channel-stats?from=${from}&to=${to}`,
        { fallbackErrorMessage: "Impossible de charger les stats des canaux." },
      ),
    staleTime: 5 * 60_000,
  });
}

// Same settled-selection source as useChannelStats, one level finer
// (channel × compétition) — used by Decisions to attach a real calibration
// badge (Fiable/À surveiller/Peu fiable) to each pick, instead of an
// internal, uncalibrated score. Long staleTime: this only moves as fast as
// daily settlement jobs, not worth refetching per navigation.
export function useChannelCompetitionStats(from: string, to: string) {
  return useQuery({
    queryKey: ["channel-competition-stats", from, to],
    queryFn: () =>
      clientApiRequest<ChannelCompetitionStatItem[]>(
        `/dashboard/channel-stats-by-competition?from=${from}&to=${to}`,
        {
          fallbackErrorMessage:
            "Impossible de charger la fiabilité des canaux.",
        },
      ),
    staleTime: 15 * 60_000,
  });
}
