"use client";

import { useMutation } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  ChannelBacktestResponse,
  ChannelTuningResponse,
  ModelCalibrationResponse,
} from "../types/channel-backtest";

/** Optional analysis window — YYYY-MM-DD, matches the backend's parseIsoDate. */
export type AnalysisWindowParams = { from?: string; to?: string };

function withWindow(path: string, params?: AnalysisWindowParams): string {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

export function useRunChannelBacktest() {
  return useMutation({
    mutationFn: (params?: AnalysisWindowParams) =>
      clientApiRequest<ChannelBacktestResponse>(
        withWindow("/backtest/channels", params),
        {
          method: "POST",
          fallbackErrorMessage: "Impossible de lancer le backtest par canal.",
        },
      ),
  });
}

export function useRunModelCalibration() {
  return useMutation({
    mutationFn: (params?: AnalysisWindowParams) =>
      clientApiRequest<ModelCalibrationResponse>(
        withWindow("/backtest/calibration", params),
        {
          method: "POST",
          fallbackErrorMessage: "Impossible de lancer la calibration modèle.",
        },
      ),
  });
}

export function useRunChannelTuning() {
  return useMutation({
    mutationFn: (params?: AnalysisWindowParams) =>
      clientApiRequest<ChannelTuningResponse>(
        withWindow("/backtest/tuning", params),
        {
          method: "POST",
          fallbackErrorMessage: "Impossible de lancer le tuning des seuils.",
        },
      ),
  });
}
