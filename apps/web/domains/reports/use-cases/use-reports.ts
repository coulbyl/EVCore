"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { MlPromotionReport, PromotionWindow } from "../types/reports";

export function useMlPromotionReport(window: PromotionWindow) {
  return useQuery({
    queryKey: ["ml-promotion-report", window],
    queryFn: () =>
      clientApiRequest<MlPromotionReport>(
        `/reports/ml-promotion?window=${window}`,
      ),
    refetchInterval: 60_000,
  });
}
