"use client";

import { useQuery } from "@tanstack/react-query";
import { authRequest } from "@/domains/auth/use-cases/auth-request";

export type OperatorSummary = {
  slipCount: number;
  wonBets: number;
  lostBets: number;
  pendingBets: number;
  settledBets: number;
  winRate: string;
};

async function fetchOperatorSummary(date?: string): Promise<OperatorSummary> {
  const path = date ? `/bet-slips/summary?date=${date}` : "/bet-slips/summary";
  return authRequest<OperatorSummary>(path, { method: "GET" });
}

export function useOperatorSummary(date?: string) {
  return useQuery({
    queryKey: ["operator-summary", date ?? null],
    queryFn: () => fetchOperatorSummary(date),
    staleTime: 60_000,
  });
}
