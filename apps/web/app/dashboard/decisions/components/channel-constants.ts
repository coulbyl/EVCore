import type {
  ChannelDecisionStatus,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";

// StrategyChannel → design tokens (1:1 with the legacy --canal-* palette).
export const CHANNEL_COLOR: Record<StrategyChannel, string> = {
  EV: "var(--canal-ev)",
  SAFE: "var(--canal-sv)",
  DOMINANT: "var(--canal-conf)",
  BTTS: "var(--canal-btts)",
  DRAW: "var(--canal-draw)",
};

export const CHANNEL_COLOR_SOFT: Record<StrategyChannel, string> = {
  EV: "var(--canal-ev-soft)",
  SAFE: "var(--canal-sv-soft)",
  DOMINANT: "var(--canal-conf-soft)",
  BTTS: "var(--canal-btts-soft)",
  DRAW: "var(--canal-draw-soft)",
};

// Short labels — i18n namespace lands in a follow-up slice (TODO Étape 5).
export const CHANNEL_LABEL: Record<StrategyChannel, string> = {
  EV: "EV",
  SAFE: "Sécurité",
  DOMINANT: "Victoire",
  BTTS: "BB",
  DRAW: "Nul",
};

export const CHANNEL_DESCRIPTION: Record<StrategyChannel, string> = {
  EV: "Cotes à valeur attendue positive.",
  SAFE: "Sélections prudentes à rendement régulier.",
  DOMINANT: "Angle le plus affirmé du modèle (1N2).",
  BTTS: "Deux équipes marquent.",
  DRAW: "Match nul via la probabilité implicite du marché.",
};

// Display order across both lenses.
export const CHANNEL_ORDER: StrategyChannel[] = [
  "EV",
  "SAFE",
  "DOMINANT",
  "BTTS",
  "DRAW",
];

// Human-readable rejection reasons emitted by the strategies (doc §5).
const REASON_LABEL: Record<string, string> = {
  score_below_threshold: "Score modèle sous le seuil",
  no_viable_pick: "Aucun pick viable",
  line_movement: "Mouvement de cote défavorable",
  no_safe_candidate: "Aucun candidat sûr",
  below_threshold: "Probabilité sous le seuil",
  insufficient_margin: "Marge insuffisante",
  BACKFILL: "Rétro-rempli",
};

export function reasonLabel(reasonCode: string | null): string | null {
  if (reasonCode === null) return null;
  return REASON_LABEL[reasonCode] ?? reasonCode;
}

// Status → label + tone for the non-selected outcomes.
export const STATUS_LABEL: Record<ChannelDecisionStatus, string> = {
  SELECTED: "Sélectionné",
  REJECTED: "Écarté",
  DISABLED: "Désactivé",
  INSUFFICIENT_DATA: "Données insuffisantes",
  MISSING_ODDS: "Cotes manquantes",
  NOT_APPLICABLE: "Non applicable",
};

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export function formatOdds(odds: number | null): string | null {
  return odds === null ? null : odds.toFixed(2);
}

export function formatEv(ev: number | null): string | null {
  return ev === null ? null : `${ev >= 0 ? "+" : ""}${(ev * 100).toFixed(0)}%`;
}
