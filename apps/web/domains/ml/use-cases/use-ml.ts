"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  BackfillResult,
  MlModelVersion,
  MlTrainingJobStatus,
  TrainResult,
} from "../types/ml";

export function useMlModels() {
  return useQuery({
    queryKey: ["ml-models"],
    queryFn: () => clientApiRequest<MlModelVersion[]>("/ml/models"),
    refetchInterval: 10_000,
  });
}

export function useActiveMlModel(segment = "ALL") {
  return useQuery({
    queryKey: ["ml-model-active", segment],
    queryFn: () =>
      clientApiRequest<MlModelVersion | null>(
        `/ml/models/active?segment=${segment}`,
      ),
  });
}

export function useTriggerBackfill() {
  const qc = useQueryClient();
  return useMutation({
    // Historical rebuild moved out of the ML module to the ETL engine rebuild
    // worker (queues one idempotent job per season).
    mutationFn: () =>
      clientApiRequest<BackfillResult>("/etl/rebuild/betting-engine", {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ml-models"] }),
  });
}

export function useTriggerTraining(segment: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      clientApiRequest<TrainResult>("/ml/train", {
        method: "POST",
        body: { segment },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ml-models"] }),
  });
}

export function useMlTrainingJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["ml-training-job", jobId],
    queryFn: () => clientApiRequest<MlTrainingJobStatus>(`/ml/train/${jobId}`),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === "completed" || state === "failed" ? false : 2_000;
    },
  });
}

export function useActivateModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      clientApiRequest<MlModelVersion>(`/ml/models/${id}/activate`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ml-models"] }),
  });
}

export function useRollbackModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      clientApiRequest<MlModelVersion>(`/ml/models/${id}/rollback`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ml-models"] }),
  });
}

export function useDeleteModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      clientApiRequest<void>(`/ml/models/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ml-models"] }),
  });
}

export function useTriggerRetrainCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      clientApiRequest<{ queued: number }>("/ml/retrain-check", {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ml-models"] }),
  });
}

export function useTriggerCatchUpSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      clientApiRequest<{ status: string }>("/ml/catch-up-switch", {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ml-models"] }),
  });
}
