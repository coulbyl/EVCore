// Shared constants for the EVA chat UI.

import type { Canal } from "@/domains/chat/types/chat";

export const CHAT_MAX_CHARS = 2000;
export const CHAT_CONTENT_MAX_WIDTH = "max-w-[46rem]"; // ~720px reading width

// Canal → badge styling, using EVCore semantic tokens (not Claude's palette).
export const CANAL_STYLE: Record<Canal, string> = {
  EV: "bg-accent/12 text-accent",
  SV: "bg-success/12 text-success",
  CONF: "bg-warning/12 text-warning",
  NUL: "bg-secondary text-secondary-foreground",
  BB: "bg-primary/12 text-primary",
};

// Canal → display label (backend says BB, bettors say BTTS).
export const CANAL_LABEL: Record<Canal, string> = {
  EV: "EV",
  SV: "SV",
  CONF: "CONF",
  NUL: "NUL",
  BB: "BTTS",
};

// Suggestion chips shown on the empty state — they teach what EVA can do.
export const SUGGESTION_CHIPS: string[] = [
  "3 propositions fiables ce week-end",
  "Quels sont les picks du jour ?",
  "Montre-moi le coupon du jour",
  "Quel canal performe le mieux ce mois-ci ?",
  "Les ligues fiables pour le BTTS ?",
];

// Unsigned percentage — for probabilities and hit rates (not deltas).
export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
