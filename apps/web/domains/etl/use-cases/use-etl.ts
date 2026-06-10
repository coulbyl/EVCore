"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  EtlBackfillResult,
  EtlClearQueueResult,
  EtlHorizonResult,
  EtlLeagueSyncResult,
  EtlQueueStatus,
  EtlRollingStatsResult,
  EtlSchedulerEntry,
  EtlStandingsResult,
  EtlSyncResult,
  GlobalSyncType,
  LeagueSyncType,
} from "../types/etl";

export function useEtlQueueStatus() {
  return useQuery({
    queryKey: ["etl-queue-status"],
    queryFn: () => clientApiRequest<EtlQueueStatus>("/etl/status"),
    refetchInterval: 5_000,
  });
}

export function useTriggerFullSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      clientApiRequest<EtlSyncResult>("/etl/sync/full", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etl-queue-status"] }),
  });
}

export function useTriggerGlobalSync(type: GlobalSyncType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date?: string) =>
      clientApiRequest<EtlSyncResult>(`/etl/sync/${type}`, {
        method: "POST",
        body: date ? { date } : undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etl-queue-status"] }),
  });
}

export function useTriggerAnalysisHorizon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts?: { startDate?: string; endDate?: string }) =>
      clientApiRequest<EtlHorizonResult>("/etl/sync/analysis-horizon", {
        method: "POST",
        body: opts ?? {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etl-queue-status"] }),
  });
}

export function useTriggerLeagueSync(type: LeagueSyncType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competitionCode: string) =>
      clientApiRequest<EtlLeagueSyncResult>(
        `/etl/sync/${type}/${competitionCode}`,
        { method: "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etl-queue-status"] }),
  });
}

export function useTriggerRollingStats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: {
      competitionCode: string;
      season: number;
      mode: "refresh" | "rebuild";
    }) =>
      clientApiRequest<EtlRollingStatsResult>(
        `/etl/sync/rolling-stats/${opts.competitionCode}/${opts.season}`,
        { method: "POST", body: { mode: opts.mode } },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etl-queue-status"] }),
  });
}

export function useTriggerStandingsSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { competitionCode: string; season: number }) =>
      clientApiRequest<EtlStandingsResult>(
        `/etl/sync/standings/${opts.competitionCode}?season=${opts.season}`,
        { method: "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etl-queue-status"] }),
  });
}

export function useTriggerFixturesBackfill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { competitionCode: string; seasons: string }) =>
      clientApiRequest<EtlBackfillResult>(
        `/etl/sync/fixtures/${opts.competitionCode}/backfill?seasons=${opts.seasons}`,
        { method: "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etl-queue-status"] }),
  });
}

export function useTriggerStatsBackfill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { competitionCode: string; seasons: string }) =>
      clientApiRequest<EtlBackfillResult>(
        `/etl/sync/stats/${opts.competitionCode}/backfill?seasons=${opts.seasons}`,
        { method: "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etl-queue-status"] }),
  });
}

export function useTriggerOddsCsvBackfill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { competitionCode: string; seasons: string }) =>
      clientApiRequest<EtlBackfillResult>(
        `/etl/sync/odds-csv/${opts.competitionCode}/backfill?seasons=${opts.seasons}`,
        { method: "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etl-queue-status"] }),
  });
}

export function useTriggerOddsHistoricalBackfill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { competitionCode: string; seasons: string }) =>
      clientApiRequest<EtlBackfillResult>(
        `/etl/sync/odds-historical/${opts.competitionCode}/backfill?seasons=${opts.seasons}`,
        { method: "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etl-queue-status"] }),
  });
}

export function useEtlSchedulers() {
  return useQuery({
    queryKey: ["etl-schedulers"],
    queryFn: () => clientApiRequest<EtlSchedulerEntry[]>("/etl/schedulers"),
    staleTime: 60_000,
  });
}

export function useClearQueueFailed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (queueName: string) =>
      clientApiRequest<EtlClearQueueResult>(`/etl/queue/${queueName}/failed`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etl-queue-status"] }),
  });
}

export function useTriggerBettingEngineDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) =>
      clientApiRequest<{ queued: boolean }>(
        `/betting-engine/analyze/date/${date}`,
        { method: "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etl-queue-status"] }),
  });
}
