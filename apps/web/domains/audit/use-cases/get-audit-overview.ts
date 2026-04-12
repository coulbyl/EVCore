"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuditOverview } from "../types/audit";
import { clientApiRequest } from "@/lib/api/client-api";

async function fetchAuditOverview(): Promise<AuditOverview> {
  return clientApiRequest<AuditOverview>("/audit/overview", {
    fallbackErrorMessage: "Impossible de charger l'overview audit.",
  });
}

export function useAuditOverview() {
  return useQuery({
    queryKey: ["audit-overview"],
    queryFn: fetchAuditOverview,
    refetchInterval: 60_000,
  });
}
