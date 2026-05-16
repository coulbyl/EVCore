"use client";

import { useCallback } from "react";
import { isWC2026Active } from "@/lib/events/world-cup-2026";

export function useWC2026Celebration() {
  return useCallback(async () => {
    if (!isWC2026Active()) return;
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 120,
      spread: 80,
      colors: ["#c9a84c", "#ffffff", "#1a2236"],
      origin: { y: 0.6 },
    });
  }, []);
}
