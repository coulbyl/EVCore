// Shared constants for the EVA chat UI.

import type { Channel } from "@/domains/chat/types/chat";

export const CHAT_MAX_CHARS = 2000;
export const CHAT_CONTENT_MAX_WIDTH = "max-w-[46rem]"; // ~720px reading width

// Channel → badge styling, using EVCore semantic tokens (not Claude's palette).
export const CHANNEL_STYLE: Record<Channel, string> = {
  VALUE: "bg-accent/12 text-accent",
  SAFE: "bg-success/12 text-success",
  DOMINANT: "bg-warning/12 text-warning",
  DRAW: "bg-secondary text-secondary-foreground",
  BTTS: "bg-primary/12 text-primary",
};

// Channel → display label (bettors read "Value / Safe / Victoire / Nul / BTTS").
export const CHANNEL_LABEL: Record<Channel, string> = {
  VALUE: "VALUE",
  SAFE: "SAFE",
  DOMINANT: "VICTOIRE",
  DRAW: "NUL",
  BTTS: "BTTS",
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
