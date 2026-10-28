"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

/** Même forme que AiTrackRecordRow (backend, dashboard.types.ts). */
export type AiTrackRecordRow = {
  configVersion: string | null;
  settled: number;
  realised: number | null;
  announced: number | null;
  market: number | null;
  gap: number | null;
  gapMargin: number | null;
  flatReturn: number | null;
  firstDay: string | null;
  lastDay: string | null;
};

export type AiTrackRecord = {
  from: string;
  to: string;
  total: AiTrackRecordRow;
  versions: AiTrackRecordRow[];
};

/** Bilan de l'IA, lu sur l'historique figé des avis (2026-10-29). */
export function useAiTrackRecord(from: string, to: string) {
  return useQuery({
    queryKey: ["ai-track-record", from, to],
    queryFn: () =>
      clientApiRequest<AiTrackRecord>(
        `/dashboard/ai-track-record?from=${from}&to=${to}`,
        { fallbackErrorMessage: "Impossible de charger le bilan de l'IA." },
      ),
    staleTime: 5 * 60_000,
  });
}
