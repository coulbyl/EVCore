"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { CouponProposalDto } from "../types/coupon";

export function useCoupons(date: string) {
  return useQuery({
    queryKey: ["coupons", date],
    queryFn: () => {
      const params = new URLSearchParams({ date });
      return clientApiRequest<CouponProposalDto[]>(
        `/coupons?${params.toString()}`,
        { fallbackErrorMessage: "Impossible de charger les coupons." },
      );
    },
    staleTime: 60_000,
  });
}

// Force re-settlement of a specific proposal — works even if it's already
// EXPIRED with a stale result (settleProposal self-corrects against the
// current fixture state).
export function useSettleCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) =>
      clientApiRequest<{ settled: boolean }>(`/coupons/${proposalId}/settle`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });
}

// Bulk catch-up: force re-settlement of every proposal (any status) whose
// forDate falls within [from, to] — use when you don't have individual IDs.
export function useSettleCouponRange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { from: string; to: string }) => {
      const params = new URLSearchParams(opts);
      return clientApiRequest<{ resettled: number }>(
        `/coupons/settle-range?${params.toString()}`,
        { method: "POST" },
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });
}
