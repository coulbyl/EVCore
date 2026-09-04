"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  DiscoverableChannel,
  LeagueCatalogItem,
  Personalization,
} from "../types/personalization";

const PERSONALIZATION_KEY = ["personalization"];

export function usePersonalization() {
  return useQuery({
    queryKey: PERSONALIZATION_KEY,
    queryFn: () =>
      clientApiRequest<Personalization>("/personalization", {
        fallbackErrorMessage: "Impossible de charger la personnalisation.",
      }),
    staleTime: 30_000,
  });
}

export function useLeagueCatalog() {
  return useQuery({
    queryKey: ["personalization", "leagues-catalog"],
    queryFn: () =>
      clientApiRequest<LeagueCatalogItem[]>(
        "/personalization/leagues/catalog",
        { fallbackErrorMessage: "Impossible de charger les championnats." },
      ),
    staleTime: 5 * 60_000,
  });
}

export function useDiscoverChannels(enabled: boolean) {
  return useQuery({
    queryKey: ["personalization", "channels-discover"],
    queryFn: () =>
      clientApiRequest<DiscoverableChannel[]>(
        "/personalization/channels/discover",
        { fallbackErrorMessage: "Impossible de charger les canaux." },
      ),
    staleTime: 60_000,
    enabled,
  });
}

export function useFollowLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      clientApiRequest<{ followed: boolean }>(
        `/personalization/leagues/${code}`,
        { method: "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: PERSONALIZATION_KEY }),
  });
}

export function useUnfollowLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      clientApiRequest<{ followed: boolean }>(
        `/personalization/leagues/${code}`,
        { method: "DELETE" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: PERSONALIZATION_KEY }),
  });
}

export function useFollowChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channel: string) =>
      clientApiRequest<{ followed: boolean }>(
        `/personalization/channels/${channel}`,
        { method: "POST" },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PERSONALIZATION_KEY });
      void qc.invalidateQueries({
        queryKey: ["personalization", "channels-discover"],
      });
    },
  });
}

export function useUnfollowChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channel: string) =>
      clientApiRequest<{ followed: boolean }>(
        `/personalization/channels/${channel}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PERSONALIZATION_KEY });
      void qc.invalidateQueries({
        queryKey: ["personalization", "channels-discover"],
      });
    },
  });
}
