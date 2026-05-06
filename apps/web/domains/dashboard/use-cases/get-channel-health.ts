"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { ChannelHealthItem, ChannelStatsItem } from "../types/dashboard";

export function useChannelHealth() {
  return useQuery({
    queryKey: ["channel-health"],
    queryFn: () =>
      clientApiRequest<ChannelHealthItem[]>("/dashboard/channel-health", {
        fallbackErrorMessage: "Impossible de charger la santé des canaux.",
      }),
    refetchInterval: 60_000,
  });
}

export function useChannelStats() {
  return useQuery({
    queryKey: ["channel-stats"],
    queryFn: () =>
      clientApiRequest<ChannelStatsItem[]>("/dashboard/channel-stats", {
        fallbackErrorMessage: "Impossible de charger les stats des canaux.",
      }),
    staleTime: 5 * 60_000,
  });
}
