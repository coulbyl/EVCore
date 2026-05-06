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
  globalRoi: string | null;
  globalRoiBetCount: number;
};

async function fetchOperatorSummary(
  from?: string,
  to?: string,
): Promise<OperatorSummary> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return authRequest<OperatorSummary>(
    `/bet-slips/summary${qs ? `?${qs}` : ""}`,
    { method: "GET" },
  );
}

export function useOperatorSummary(from?: string, to?: string) {
  return useQuery({
    queryKey: ["operator-summary", from ?? null, to ?? null],
    queryFn: () => fetchOperatorSummary(from, to),
    staleTime: 60_000,
  });
}
