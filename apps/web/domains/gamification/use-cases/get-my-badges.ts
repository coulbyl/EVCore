"use client";

import { useQuery } from "@tanstack/react-query";
import type { UserBadge } from "../types/gamification";
import { clientApiRequest } from "@/lib/api/client-api";

export function useMyBadges() {
  return useQuery({
    queryKey: ["gamification-badges-me"],
    queryFn: () =>
      clientApiRequest<{ badges: UserBadge[] }>("/gamification/badges/me", {
        fallbackErrorMessage: "Impossible de charger les badges.",
      }).then((r) => r.badges),
    staleTime: 5 * 60_000,
  });
}
