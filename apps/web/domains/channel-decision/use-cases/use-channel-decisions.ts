"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  ChannelDecisionChannelGroupDto,
  ChannelDecisionFilters,
  ChannelDecisionMatchDto,
} from "../types/channel-decision";

function buildDecisionSearchParams(
  date: string,
  filters: ChannelDecisionFilters,
) {
  const { competition, channel, market, status, phase } = filters;
  const params = new URLSearchParams({ date });
  if (competition) params.set("competition", competition);
  if (channel) params.set("channel", channel);
  if (market) params.set("market", market);
  if (status) params.set("status", status);
  if (phase) params.set("phase", phase);
  return params;
}

function decisionQueryKey(
  scope: string,
  date: string,
  filters: ChannelDecisionFilters,
) {
  return [
    scope,
    date,
    filters.competition,
    filters.channel,
    filters.market,
    filters.status,
    filters.phase,
  ];
}

export function useChannelDecisionMatches(
  date: string,
  filters: ChannelDecisionFilters = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: decisionQueryKey("channel-decisions-by-match", date, filters),
    queryFn: () => {
      const params = buildDecisionSearchParams(date, filters);
      return clientApiRequest<ChannelDecisionMatchDto[]>(
        `/channel-decisions/by-match?${params.toString()}`,
        {
          fallbackErrorMessage:
            "Impossible de charger les décisions par match.",
        },
      );
    },
    enabled: options.enabled ?? true,
    staleTime: 120_000,
  });
}

export function useChannelDecisionChannels(
  date: string,
  filters: ChannelDecisionFilters = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: decisionQueryKey("channel-decisions-by-channel", date, filters),
    queryFn: () => {
      const params = buildDecisionSearchParams(date, filters);
      return clientApiRequest<ChannelDecisionChannelGroupDto[]>(
        `/channel-decisions/by-channel?${params.toString()}`,
        {
          fallbackErrorMessage:
            "Impossible de charger les décisions par canal.",
        },
      );
    },
    enabled: options.enabled ?? true,
    staleTime: 120_000,
  });
}
