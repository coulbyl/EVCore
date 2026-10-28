"use client";

import { useCurrentUser } from "../context/current-user-context";
import { activePauseEnd } from "../types/auth";

/** Fin de la pause en cours du joueur connecté, ou null. */
export function useActivePause(): string | null {
  const user = useCurrentUser();
  return activePauseEnd(user.pausedUntil);
}
