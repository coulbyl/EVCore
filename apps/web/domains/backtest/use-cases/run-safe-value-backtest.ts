"use client";

import { useMutation } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { SafeValueBacktestReport } from "../types/backtest";

export function useRunSafeValueBacktest() {
  return useMutation({
    mutationFn: () =>
      clientApiRequest<SafeValueBacktestReport>("/backtest/safe-value", {
        method: "POST",
        fallbackErrorMessage: "Impossible de lancer le backtest Safe Value.",
      }),
  });
}
