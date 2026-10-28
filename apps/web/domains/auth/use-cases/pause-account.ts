"use client";

import { authRequest } from "./auth-request";

export const PAUSE_DURATIONS_DAYS = [1, 7, 30] as const;
export type PauseDurationDays = (typeof PAUSE_DURATIONS_DAYS)[number];

export async function pauseAccount(
  days: PauseDurationDays,
): Promise<{ pausedUntil: string }> {
  return authRequest<{ pausedUntil: string }>("/auth/me/pause", {
    body: { days },
    fallbackErrorMessage: "Impossible de commencer la pause.",
  });
}
