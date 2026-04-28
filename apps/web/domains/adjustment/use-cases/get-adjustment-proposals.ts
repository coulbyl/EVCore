"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { AdjustmentProposal } from "../types/adjustment";

export function useAdjustmentProposals() {
  return useQuery({
    queryKey: ["adjustment-proposals"],
    queryFn: () =>
      clientApiRequest<AdjustmentProposal[]>("/adjustment", {
        fallbackErrorMessage:
          "Impossible de charger les recalibrations du modèle.",
      }),
    refetchInterval: 5 * 60_000,
  });
}
