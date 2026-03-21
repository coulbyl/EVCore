"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAuditFixtures } from "../lib/dashboard-api";

export function useAuditFixtures(date: string) {
  return useQuery({
    queryKey: ["audit-fixtures", date],
    queryFn: () => fetchAuditFixtures(date),
  });
}
