"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { CalibrationBin } from "../types/calibration";

export function useCalibrationCurve() {
  return useQuery({
    queryKey: ["calibration-curve"],
    queryFn: () =>
      clientApiRequest<CalibrationBin[]>("/risk/calibration-curve", {
        fallbackErrorMessage: "Impossible de charger la courbe de calibration.",
      }),
    staleTime: 10 * 60_000,
  });
}
