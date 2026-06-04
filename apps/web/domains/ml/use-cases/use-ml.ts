"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { BackfillResult, MlModelVersion, TrainResult } from "../types/ml";

export function useMlModels() {
  return useQuery({
    queryKey: ["ml-models"],
    queryFn: () => clientApiRequest<MlModelVersion[]>("/ml/models"),
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
    mutationFn: () =>
      clientApiRequest<BackfillResult>("/ml/backfill", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ml-models"] }),
  });
}

export function useTriggerTraining(segment: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      clientApiRequest<TrainResult>("/ml/train", {
        method: "POST",
        body: JSON.stringify({ segment }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ml-models"] }),
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
