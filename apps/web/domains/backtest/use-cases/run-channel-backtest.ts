"use client";

import { useMutation } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  ChannelBacktestResponse,
  ChannelTuningResponse,
  ModelCalibrationResponse,
} from "../types/channel-backtest";

export function useRunChannelBacktest() {
  return useMutation({
    mutationFn: () =>
      clientApiRequest<ChannelBacktestResponse>("/backtest/channels", {
        method: "POST",
        fallbackErrorMessage: "Impossible de lancer le backtest par canal.",
      }),
  });
}

export function useRunModelCalibration() {
  return useMutation({
    mutationFn: () =>
      clientApiRequest<ModelCalibrationResponse>("/backtest/calibration", {
        method: "POST",
        fallbackErrorMessage: "Impossible de lancer la calibration modèle.",
      }),
  });
}

export function useRunChannelTuning() {
  return useMutation({
    mutationFn: () =>
      clientApiRequest<ChannelTuningResponse>("/backtest/tuning", {
        method: "POST",
        fallbackErrorMessage: "Impossible de lancer le tuning des seuils.",
      }),
  });
}
