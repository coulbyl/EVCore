"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { TrackRecordSummary } from "../types/dashboard";

/**
 * Annoncé et réalisé sur la cohorte de Mesures historiques, découpés par
 * tranche de cote. Décisions s'en sert pour dire, sous un pronostic, si les
 * pourcentages tiennent à cette cote : c'est la seule lecture qui se
 * maintient d'une période à l'autre (CLAUDE.md : couper sur la cote, jamais
 * sur le canal). Ne bouge qu'au rythme des règlements quotidiens.
 */
export function useTrackRecordSummary(from: string, to: string) {
  return useQuery({
    queryKey: ["track-record-summary", from, to],
    queryFn: () =>
      clientApiRequest<TrackRecordSummary>(
        `/dashboard/track-record-summary?from=${from}&to=${to}`,
        { fallbackErrorMessage: "Impossible de charger le relevé par cote." },
      ),
    staleTime: 30 * 60_000,
  });
}
