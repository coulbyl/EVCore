"use client";

import { useQuery } from "@tanstack/react-query";
import type { WC2026StandingsData } from "@/app/api/wc2026/standings/route";

async function fetchWC2026Standings(): Promise<WC2026StandingsData> {
  const res = await fetch("/api/wc2026/standings");
  if (!res.ok) throw new Error("Failed to fetch WC2026 standings");
  return res.json() as Promise<WC2026StandingsData>;
}

export function useWC2026Standings() {
  return useQuery({
    queryKey: ["wc2026-standings"],
    queryFn: fetchWC2026Standings,
    staleTime: 60 * 60_000, // 1h
    retry: 1,
  });
}
