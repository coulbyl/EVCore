"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { ChannelHealthItem, ChannelStatsItem } from "../types/dashboard";

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
