"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  formatPlayerText,
  type PlayerClientNamespace,
  type PlayerTexts,
} from "./player-texts-constants";

const PlayerTextsContext = createContext<PlayerTexts | null>(null);

/**
 * The few texts the player's client components show (shell, states), set
 * by the player layout. Not next-intl's client provider: its message
 * engine weighed 11.8 kio of the player's JS for under a kilobyte of
 * simple texts, and the provider sent every message of the app, dashboard
 * included, with each page (C0).
 */
export function PlayerTextsProvider({
  texts,
  children,
}: {
  texts: PlayerTexts;
  children: ReactNode;
}) {
  return (
    <PlayerTextsContext.Provider value={texts}>
      {children}
    </PlayerTextsContext.Provider>
  );
}

/** Same call shape as next-intl's `useTranslations`, for these namespaces. */
export function usePlayerText(namespace: PlayerClientNamespace) {
  const texts = useContext(PlayerTextsContext);
  if (!texts) {
    throw new Error("usePlayerText needs PlayerTextsProvider (player layout)");
  }
  const messages = texts[namespace];
  return (key: string, values?: Record<string, string>) =>
    formatPlayerText(messages, key, values);
}
