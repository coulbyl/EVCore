"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

type Rate = { eligible: number; rate: number | null };

/** GET /dashboard/retention (admin, lot 4) : même forme que RetentionView. */
export type RetentionView = {
  asOf: string;
  active: { dau: number; wau: number; mau: number };
  engagement: {
    weeklyActive: number;
    followedRate: number | null;
    declaredRate: number | null;
  };
  notifications: {
    type: string;
    sent: number;
    opened: number;
    rate: number | null;
  }[];
  cohorts: {
    week: string;
    signups: number;
    activation: number | null;
    d7: Rate;
    d14: Rate;
    d30: Rate;
  }[];
};

export function useRetention() {
  return useQuery({
    queryKey: ["dashboard-retention"],
    queryFn: () =>
      clientApiRequest<RetentionView>("/dashboard/retention", {
        fallbackErrorMessage: "Impossible de charger la fidélisation.",
      }),
    staleTime: 10 * 60_000,
  });
}
