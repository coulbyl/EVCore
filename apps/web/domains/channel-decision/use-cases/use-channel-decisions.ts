"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  ChannelDecisionDto,
  ChannelDecisionFilters,
} from "../types/channel-decision";

export function useChannelDecisions(
  date: string,
  filters: ChannelDecisionFilters = {},
) {
  const { competition, channel, market, status, phase } = filters;
  return useQuery({
    queryKey: [
      "channel-decisions",
      date,
      competition,
      channel,
      market,
      status,
      phase,
    ],
    queryFn: () => {
      const params = new URLSearchParams({ date });
      if (competition) params.set("competition", competition);
      if (channel) params.set("channel", channel);
      if (market) params.set("market", market);
      if (status) params.set("status", status);
      if (phase) params.set("phase", phase);
      return clientApiRequest<ChannelDecisionDto[]>(
        `/channel-decisions?${params.toString()}`,
        {
          fallbackErrorMessage:
            "Impossible de charger les décisions des canaux.",
        },
      );
    },
    staleTime: 120_000,
  });
}
