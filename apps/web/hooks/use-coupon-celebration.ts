"use client";

import { useEffect, useRef } from "react";
import type { CouponProposalDto } from "@/domains/ai-engine/types/coupon";

function hasWinningMajority(coupons: CouponProposalDto[]): boolean {
  if (coupons.length === 0) return false;

  const wonCount = coupons.filter((coupon) => coupon.result === "WON").length;
  return wonCount >= Math.ceil(coupons.length / 2);
}

export function useCouponCelebration(coupons: CouponProposalDto[]) {
  const lastSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasWinningMajority(coupons)) return;

    const signature = coupons
      .map((coupon) => coupon.id)
      .sort()
      .join(",");
    if (lastSignatureRef.current === signature) return;

    lastSignatureRef.current = signature;

    let cancelled = false;

    async function celebrate() {
      const confetti = (await import("canvas-confetti")).default;
      if (cancelled) return;

      confetti({
        particleCount: 120,
        spread: 80,
        colors: ["#c9a84c", "#ffffff", "#1a2236"],
        origin: { y: 0.6 },
      });
    }

    void celebrate();

    return () => {
      cancelled = true;
    };
  }, [coupons]);
}
