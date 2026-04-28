"use client";

import { useMutation } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { BacktestResponse } from "../types/backtest";

export function useRunBacktest() {
  return useMutation({
    mutationFn: () =>
      clientApiRequest<BacktestResponse>("/backtest", {
        method: "POST",
        fallbackErrorMessage: "Impossible de lancer le backtest.",
      }),
  });
}
