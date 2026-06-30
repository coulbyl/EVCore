"use client";

import { useEffect, useMemo, useRef } from "react";
import type { FixtureRow } from "@/domains/fixture/types/fixture";

type SettledPickStatus = "WON" | "LOST";

const MIN_SETTLED_PICKS = 4;

function collectSettledStatuses(rows: FixtureRow[]): SettledPickStatus[] {
  return rows.flatMap((row) => {
    const statuses: SettledPickStatus[] = [];

    if (
      row.modelRun?.betStatus === "WON" ||
      row.modelRun?.betStatus === "LOST"
    ) {
      statuses.push(row.modelRun.betStatus);
    }

    return statuses;
  });
}

export function usePickCelebration(rows: FixtureRow[], scopeKey: string) {
  const lastSignatureRef = useRef<string | null>(null);

  const settledStatuses = useMemo(() => collectSettledStatuses(rows), [rows]);

  useEffect(() => {
    const settledCount = settledStatuses.length;
    if (settledCount < MIN_SETTLED_PICKS) return;

    const wonCount = settledStatuses.filter(
      (status) => status === "WON",
    ).length;
    if (wonCount < Math.ceil(settledCount / 2)) return;

    const signature = `${scopeKey}:${settledCount}:${wonCount}`;
    if (lastSignatureRef.current === signature) return;

    lastSignatureRef.current = signature;

    let cancelled = false;

    async function celebrate() {
      const confetti = (await import("canvas-confetti")).default;
      if (cancelled) return;

      confetti({
        particleCount: 140,
        spread: 85,
        colors: ["#22c55e", "#ffffff", "#0f172a"],
        origin: { y: 0.62 },
      });
    }

    void celebrate();

    return () => {
      cancelled = true;
    };
  }, [scopeKey, settledStatuses]);
}
