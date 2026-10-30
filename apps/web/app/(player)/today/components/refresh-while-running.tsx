"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Every 5 min: kick-offs land on time, settlements (every 30 min) soon. */
const REFRESH_MS = 5 * 60_000;

/**
 * « Le résultat tombe pendant qu'on regarde » (04 § 5) : tant qu'un coupon
 * de l'écran n'est pas réglé, l'écran se relit tout seul, onglet visible et
 * réseau présent. Pas d'animation : le ✓ ou le ✗ apparaît, c'est tout.
 */
export function RefreshWhileRunning({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        router.refresh();
      }
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [active, router]);

  return null;
}
