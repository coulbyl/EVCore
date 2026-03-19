"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAuditOverview } from "../lib/dashboard-api";

export function useAuditOverview() {
  return useQuery({
    queryKey: ["audit-overview"],
    queryFn: fetchAuditOverview,
    refetchInterval: 60_000,
  });
}
