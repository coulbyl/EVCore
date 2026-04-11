"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuditOverview } from "../types/audit";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchAuditOverview(): Promise<AuditOverview> {
  const response = await fetch(`${BACKEND_URL}/audit/overview`);
  if (!response.ok) {
    throw new Error(
      `Impossible de charger l'overview audit (${response.status})`,
    );
  }
  return (await response.json()) as AuditOverview;
}

export function useAuditOverview() {
  return useQuery({
    queryKey: ["audit-overview"],
    queryFn: fetchAuditOverview,
    refetchInterval: 60_000,
  });
}
