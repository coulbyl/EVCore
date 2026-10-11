"use client";

import { useEffect, useRef } from "react";
import type { CouponProposalDto } from "@/domains/coupon/types/coupon";
import { todayIso } from "@/lib/date";

const CELEBRATED_KEY_PREFIX = "evcore-coupon-celebrated:";

function hasWinningMajority(coupons: CouponProposalDto[]): boolean {
  if (coupons.length === 0) return false;

  // PARTIAL = toutes les jambes gradées gagnées, une jambe remboursée en
  // route : c'est un gain payé, pas un demi-résultat.
  const wonCount = coupons.filter(
    (coupon) => coupon.result === "WON" || coupon.result === "PARTIAL",
  ).length;
  return wonCount >= Math.ceil(coupons.length / 2);
}

function readCelebrated(date: string): boolean {
  try {
    return localStorage.getItem(CELEBRATED_KEY_PREFIX + date) === "1";
  } catch {
    return false;
  }
}

function writeCelebrated(date: string): void {
  try {
    localStorage.setItem(CELEBRATED_KEY_PREFIX + date, "1");
  } catch {
    // Stockage indisponible : on célèbre, sans mémoire.
  }
}

/**
 * Confettis sur une journée gagnante.
 *
 * Trois conditions, toutes mesurées (revue UX du 2026-10-11, P2-18) : la
 * majorité des coupons du jour a gagné, l'utilisateur en a joué au moins un
 * — un gain qu'on n'a pas joué n'est pas le sien —, et la fête n'a pas déjà
 * eu lieu aujourd'hui sur cet appareil : la page du jour se rouvre dix fois,
 * les confettis ne tombent qu'une fois.
 */
export function useCouponCelebration(coupons: CouponProposalDto[]) {
  const lastSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasWinningMajority(coupons)) return;
    const date = coupons[0]?.forDate;
    if (!date || date !== todayIso()) return;
    if (!coupons.some((coupon) => coupon.playedByMe)) return;
    if (readCelebrated(date)) return;

    const signature = coupons
      .map((coupon) => coupon.id)
      .sort()
      .join(",");
    if (lastSignatureRef.current === signature) return;

    lastSignatureRef.current = signature;
    writeCelebrated(date);

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
