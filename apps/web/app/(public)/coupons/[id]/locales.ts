export type Locale = "fr" | "en";

export const locales = {
  fr: {
    coupon: "Coupon",
    refresh: "Rafraîchir",
    loading: "Chargement…",
    notFound: "Coupon introuvable.",
    summary: "Résumé",
    engineDiagnostics: "Diagnostics moteur",
    leg: "Leg",
    noPicks: "Aucun pick.",
    tableHeaders: {
      marketPick: "Marché / Pick",
      prob: "Prob.",
      odds: "Cote",
      ev: "EV",
      quality: "Qualité",
      status: "Statut",
    },
    modelInputs: "Entrées modèle",
    probEstimated: "Prob. estimée",
    lambdaHome: "λ Domicile",
    lambdaAway: "λ Extérieur",
    expectedGoals: "Buts attendus",
    candidatePicks: (n: number) => `Picks candidats (${n})`,
    evaluatedPicks: (n: number) => `Picks évalués (${n})`,
  },
  en: {
    coupon: "Coupon",
    refresh: "Refresh",
    loading: "Loading…",
    notFound: "Coupon not found.",
    summary: "Summary",
    engineDiagnostics: "Engine diagnostics",
    leg: "Leg",
    noPicks: "No picks.",
    tableHeaders: {
      marketPick: "Market / Pick",
      prob: "Prob.",
      odds: "Odds",
      ev: "EV",
      quality: "Quality",
      status: "Status",
    },
    modelInputs: "Model inputs",
    probEstimated: "Est. probability",
    lambdaHome: "λ Home",
    lambdaAway: "λ Away",
    expectedGoals: "Expected goals",
    candidatePicks: (n: number) => `Candidate picks (${n})`,
    evaluatedPicks: (n: number) => `Evaluated picks (${n})`,
  },
} satisfies Record<Locale, unknown>;

export type Translations = (typeof locales)["fr"];

export function getLocale(param: string | null): Locale {
  return param === "en" ? "en" : "fr";
}
