import type {
  CoreInvestmentCanal,
  InvestmentCanal,
  VirtualInvestmentCanal,
} from "@/domains/ai-engine/types/investment";

export const CANAL_COLOR: Record<InvestmentCanal, string> = {
  SV: "var(--canal-sv)",
  EV: "var(--canal-ev)",
  CONF: "var(--canal-conf)",
  BB: "var(--canal-btts)",
  NUL: "var(--canal-draw)",
  SAFE_HT_OVER05: "var(--success)",
  SAFE_UNDER45: "var(--warning)",
  SAFE_OVER15: "var(--canal-sv)",
  SAFE_UNDER35: "var(--canal-conf)",
  BTTS_YES: "var(--canal-btts)",
};

export const CANAL_LABEL: Record<InvestmentCanal, string> = {
  SV: "SV",
  EV: "EV",
  CONF: "VICTOIRE",
  BB: "BB",
  NUL: "NUL",
  SAFE_HT_OVER05: "OVER 0.5 MT",
  SAFE_UNDER45: "UNDER 4.5",
  SAFE_OVER15: "OVER 1.5",
  SAFE_UNDER35: "UNDER 3.5",
  BTTS_YES: "BTTS YES",
};

export const CANAL_DESCRIPTION: Record<InvestmentCanal, string> = {
  SV: "Sélections prudentes à rendement régulier.",
  BB: "Matchs ouverts avec potentiel des deux côtés.",
  CONF: "Angles les plus affirmés du modèle.",
  NUL: "Scénarios de marché plus rares mais payants.",
  EV: "Cotes plus agressives avec valeur attendue.",
  SAFE_HT_OVER05: "But attendu avant la pause.",
  SAFE_UNDER45: "Marge haute sur le total de buts.",
  SAFE_OVER15: "Deux buts minimum sur profil stable.",
  SAFE_UNDER35: "Match contenu sous quatre buts.",
  BTTS_YES: "Deux attaques avec signal positif.",
};

export const CANAL_ORDER: CoreInvestmentCanal[] = [
  "SV",
  "BB",
  "CONF",
  "NUL",
  "EV",
];

export const VIRTUAL_CANAL_ORDER: VirtualInvestmentCanal[] = [
  "SAFE_HT_OVER05",
  "SAFE_UNDER45",
  "SAFE_OVER15",
  "SAFE_UNDER35",
  "BTTS_YES",
];

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
