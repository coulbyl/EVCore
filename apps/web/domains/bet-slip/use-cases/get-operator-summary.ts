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
  /**
   * Résultat du joueur à mise fixe, une unité par pari joué (une jambe d'un
   * coupon simple, un combiné entier) — calculé côté backend.
   */
  plays: {
    won: number;
    lost: number;
    void: number;
    pending: number;
    settled: number;
    /** Gain net en unités, signé (« -0.42 »). */
    profitUnits: string;
    /** Gain net / paris réglés (« -0.0410 »), null sans pari réglé. */
    returnRate: string | null;
  };
  /**
   * Résultat en francs, mises déclarées, même règle que le solde (une jambe
   * remboursée rend sa mise) — calculé côté backend.
   */
  money: {
    settledSlips: number;
    settledStake: string;
    returned: string;
    net: string;
    pendingStake: string;
    firstSlipAt: string | null;
  };
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
