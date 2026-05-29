import type { InvestmentCanal } from "@/domains/ai-engine/types/investment";

export const CANAL_COLOR: Record<InvestmentCanal, string> = {
  SV: "var(--canal-sv)",
  EV: "var(--canal-ev)",
  CONF: "var(--canal-conf)",
  BB: "var(--canal-btts)",
  NUL: "var(--canal-draw)",
};

export const CANAL_LABEL: Record<InvestmentCanal, string> = {
  SV: "SV",
  EV: "EV",
  CONF: "VICTOIRE",
  BB: "BB",
  NUL: "NUL",
};

export const CANAL_DESCRIPTION: Record<InvestmentCanal, string> = {
  SV: "Sélections prudentes à rendement régulier.",
  BB: "Matchs ouverts avec potentiel des deux côtés.",
  CONF: "Angles les plus affirmés du modèle.",
  NUL: "Scénarios de marché plus rares mais payants.",
  EV: "Cotes plus agressives avec valeur attendue.",
};

export const CANAL_ORDER: InvestmentCanal[] = ["SV", "BB", "CONF", "NUL", "EV"];

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
