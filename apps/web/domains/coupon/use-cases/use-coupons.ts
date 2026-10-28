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
        { fallbackErrorMessage: "Impossible de charger les coupons proposés." },
      );
    },
    staleTime: 60_000,
  });
}

export type CouponAbstention = { couponClass: string; reason: string | null };

/** Produits du jour qui se sont abstenus, avec leur raison (2026-10-29). */
export function useCouponAbstentions(date: string) {
  return useQuery({
    queryKey: ["coupon-abstentions", date],
    queryFn: () =>
      clientApiRequest<CouponAbstention[]>(
        `/coupons/abstentions?${new URLSearchParams({ date }).toString()}`,
      ),
    staleTime: 5 * 60_000,
  });
}

// Records a real, verifiable "view" (CouponProposalView, idempotent —
// upserted server-side) — never a fabricated counter. Fire-and-forget: a
// failed call just means one view goes uncounted, not worth surfacing to
// the user or retrying.
export function useRecordCouponView() {
  return useMutation({
    mutationFn: (proposalId: string) =>
      clientApiRequest<void>(`/coupons/${proposalId}/view`, {
        method: "POST",
      }),
  });
}

/**
 * « Suivre ce coupon » (2026-10-28) : suivre sans mise, le résultat arrive
 * dans le résumé du matin. `follow: false` arrête de suivre.
 */
export function useFollowCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, follow }: { id: string; follow: boolean }) =>
      clientApiRequest<void>(`/coupons/${id}/follow`, {
        method: follow ? "POST" : "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
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
