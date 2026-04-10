export type Locale = "fr" | "en";

export const locales = {
  fr: {
    back: "Retour",
    coupon: "Coupon",
    refresh: "Rafraîchir",
    share: "Partager",
    copyCoupon: "Copier le coupon",
    copyLeg: "Copier",
    copyDiagnostics: "Copier les diagnostics",
    copied: "Copié !",
    loading: "Chargement…",
    notFound: "Coupon introuvable.",
    summary: "Résumé",
    engineDiagnostics: "Diagnostics moteur",
    leg: "Sélection",
    ht: "MT",
    noPicks: "Aucun pick.",
    tableHeaders: {
      marketPick: "Marché / Pick",
      prob: "Prob.",
      odds: "Cote",
      ev: "EV",
      quality: "Qualité",
      status: "Statut",
      reason: "Raison",
    },
    modelInputs: "Entrées modèle",
    probEstimated: "Prob. estimée",
    lambdaHome: "λ V1",
    lambdaAway: "λ V2",
    expectedGoals: "Buts attendus",
    candidatePicks: (n: number) => `Picks candidats (${n})`,
    evaluatedPicks: (n: number) => `Picks évalués (${n})`,
    pickStatuses: {
      viable: "Viable",
      rejected: "Rejeté",
    },
    rejectionReasons: {
      ev_below_threshold: "EV insuffisant",
      odds_below_floor: "Cote trop basse",
      odds_above_cap: "Cote trop haute",
      quality_score_below_threshold: "Score qualité insuffisant",
      market_suspended: "Marché suspendu",
      filtered_longshot: "Longshot filtré",
    } as Record<string, string>,
    // Shared component labels
    selectionCount: "Sélections",
    combinedOdds: "Cote combinée",
    singleOdds: "Cote",
    evCoupon: "EV coupon",
    modeSimple: "Simple",
    modeCombined: "Combiné",
    betStatuses: {
      WON: "GAGNÉ",
      LOST: "PERDU",
      PENDING_scheduled: "PLANIFIÉ",
      PENDING_in_progress: "EN COURS",
      PENDING_finished: "EN ATTENTE",
      PENDING_default: "EN COURS",
      VOID: "VOID",
    },
    couponStatuses: {
      WON: "GAGNÉ",
      LOST: "PERDU",
      PENDING_scheduled: "PLANIFIÉ",
      PENDING_in_progress: "EN COURS",
      PENDING_finished: "EN ATTENTE",
      PENDING_default: "EN COURS",
    },
    fixtureStatuses: {
      finished: "Terminé",
      in_progress: "En cours",
      postponed: "Reporté",
      cancelled: "Annulé",
      default: "Planifié",
    },
    pickLabels: {
      ONE_X_TWO_HOME: "V1",
      ONE_X_TWO_DRAW: "NUL",
      ONE_X_TWO_AWAY: "V2",
      MATCH_WINNER_HOME: "V1",
      MATCH_WINNER_DRAW: "NUL",
      MATCH_WINNER_AWAY: "V2",
      BTTS_YES: "BB OUI",
      BTTS_NO: "BB NON",
      HALF_TIME_FULL_TIME_HOME_HOME: "V1 / V1",
      HALF_TIME_FULL_TIME_HOME_DRAW: "V1 / NUL",
      HALF_TIME_FULL_TIME_HOME_AWAY: "V1 / V2",
      HALF_TIME_FULL_TIME_DRAW_HOME: "NUL / V1",
      HALF_TIME_FULL_TIME_DRAW_DRAW: "NUL / NUL",
      HALF_TIME_FULL_TIME_DRAW_AWAY: "NUL / V2",
      HALF_TIME_FULL_TIME_AWAY_HOME: "V2 / V1",
      HALF_TIME_FULL_TIME_AWAY_DRAW: "V2 / NUL",
      HALF_TIME_FULL_TIME_AWAY_AWAY: "V2 / V2",
      OVER_UNDER_OVER_1_5: "PLUS DE 1.5",
      OVER_UNDER_UNDER_1_5: "MOINS DE 1.5",
      OVER_UNDER_OVER: "PLUS DE 2.5",
      OVER_UNDER_UNDER: "MOINS DE 2.5",
      OVER_UNDER_OVER_3_5: "PLUS DE 3.5",
      OVER_UNDER_UNDER_3_5: "MOINS DE 3.5",
      OVER_UNDER_25_OVER: "PLUS DE 2.5",
      OVER_UNDER_25_UNDER: "MOINS DE 2.5",
      OVER_UNDER_HT_OVER_0_5: "PLUS DE 0.5 MT",
      OVER_UNDER_HT_UNDER_0_5: "MOINS DE 0.5 MT",
      OVER_UNDER_HT_OVER_1_5: "PLUS DE 1.5 MT",
      OVER_UNDER_HT_UNDER_1_5: "MOINS DE 1.5 MT",
      FIRST_HALF_WINNER_HOME: "MT DOMICILE",
      FIRST_HALF_WINNER_DRAW: "MT NUL",
      FIRST_HALF_WINNER_AWAY: "MT EXTÉRIEUR",
    } as Record<string, string>,
  },
  en: {
    back: "Back",
    coupon: "Coupon",
    refresh: "Refresh",
    share: "Share",
    copyCoupon: "Copy coupon",
    copyLeg: "Copy",
    copyDiagnostics: "Copy diagnostics",
    copied: "Copied!",
    loading: "Loading…",
    notFound: "Coupon not found.",
    summary: "Summary",
    engineDiagnostics: "Engine diagnostics",
    leg: "Leg",
    ht: "HT",
    noPicks: "No picks.",
    tableHeaders: {
      marketPick: "Market / Pick",
      prob: "Prob.",
      odds: "Odds",
      ev: "EV",
      quality: "Quality",
      status: "Status",
      reason: "Reason",
    },
    modelInputs: "Model inputs",
    probEstimated: "Est. probability",
    lambdaHome: "λ HOME",
    lambdaAway: "λ AWAY",
    expectedGoals: "Expected goals",
    candidatePicks: (n: number) => `Candidate picks (${n})`,
    evaluatedPicks: (n: number) => `Evaluated picks (${n})`,
    pickStatuses: {
      viable: "Viable",
      rejected: "Rejected",
    },
    rejectionReasons: {
      ev_below_threshold: "EV below threshold",
      odds_below_floor: "Odds below floor",
      odds_above_cap: "Odds above cap",
      quality_score_below_threshold: "Quality score too low",
      market_suspended: "Market suspended",
      filtered_longshot: "Longshot filtered",
    } as Record<string, string>,
    // Shared component labels
    selectionCount: "Selections",
    combinedOdds: "Combined odds",
    singleOdds: "Odds",
    evCoupon: "Coupon EV",
    modeSimple: "Single",
    modeCombined: "Combined",
    betStatuses: {
      WON: "WON",
      LOST: "LOST",
      PENDING_scheduled: "SCHEDULED",
      PENDING_in_progress: "IN PROGRESS",
      PENDING_finished: "PENDING",
      PENDING_default: "IN PROGRESS",
      VOID: "VOID",
    },
    couponStatuses: {
      WON: "WON",
      LOST: "LOST",
      PENDING_scheduled: "SCHEDULED",
      PENDING_in_progress: "IN PROGRESS",
      PENDING_finished: "PENDING",
      PENDING_default: "IN PROGRESS",
    },
    fixtureStatuses: {
      finished: "Finished",
      in_progress: "In progress",
      postponed: "Postponed",
      cancelled: "Cancelled",
      default: "Scheduled",
    },
    pickLabels: {
      ONE_X_TWO_HOME: "HOME",
      ONE_X_TWO_DRAW: "DRAW",
      ONE_X_TWO_AWAY: "AWAY",
      MATCH_WINNER_HOME: "HOME",
      MATCH_WINNER_DRAW: "DRAW",
      MATCH_WINNER_AWAY: "AWAY",
      BTTS_YES: "BTTS YES",
      BTTS_NO: "BTTS NO",
      HALF_TIME_FULL_TIME_HOME_HOME: "HOME / HOME",
      HALF_TIME_FULL_TIME_HOME_DRAW: "HOME / DRAW",
      HALF_TIME_FULL_TIME_HOME_AWAY: "HOME / AWAY",
      HALF_TIME_FULL_TIME_DRAW_HOME: "DRAW / HOME",
      HALF_TIME_FULL_TIME_DRAW_DRAW: "DRAW / DRAW",
      HALF_TIME_FULL_TIME_DRAW_AWAY: "DRAW / AWAY",
      HALF_TIME_FULL_TIME_AWAY_HOME: "AWAY / HOME",
      HALF_TIME_FULL_TIME_AWAY_DRAW: "AWAY / DRAW",
      HALF_TIME_FULL_TIME_AWAY_AWAY: "AWAY / AWAY",
      OVER_UNDER_OVER_1_5: "OVER 1.5",
      OVER_UNDER_UNDER_1_5: "UNDER 1.5",
      OVER_UNDER_OVER: "OVER 2.5",
      OVER_UNDER_UNDER: "UNDER 2.5",
      OVER_UNDER_OVER_3_5: "OVER 3.5",
      OVER_UNDER_UNDER_3_5: "UNDER 3.5",
      OVER_UNDER_25_OVER: "OVER 2.5",
      OVER_UNDER_25_UNDER: "UNDER 2.5",
      OVER_UNDER_HT_OVER_0_5: "OVER 0.5 HT",
      OVER_UNDER_HT_UNDER_0_5: "UNDER 0.5 HT",
      OVER_UNDER_HT_OVER_1_5: "OVER 1.5 HT",
      OVER_UNDER_HT_UNDER_1_5: "UNDER 1.5 HT",
      FIRST_HALF_WINNER_HOME: "HT HOME",
      FIRST_HALF_WINNER_DRAW: "HT DRAW",
      FIRST_HALF_WINNER_AWAY: "HT AWAY",
    } as Record<string, string>,
  },
} satisfies Record<Locale, unknown>;

export function formatPickLabel(
  market: string,
  pick: string,
  t: Translations,
): string {
  const key = `${market}_${pick}`;
  return t.pickLabels[key] ?? `${market} ${pick}`;
}

// Translates a raw selection.pick string which can be:
//   single: "HOME"  (with market="ONE_X_TWO")     → looks up ONE_X_TWO_HOME
//   combo:  "ONE_X_TWO HOME + BTTS NO"            → splits on " + ", each part is "{MARKET} {PICK}"
export function formatSelectionPickLabel(
  pick: string,
  market: string,
  t: Translations,
): string {
  const parts = pick.split(" + ");
  return parts
    .map((part) => {
      const tokens = part.trim().split(" ");
      if (tokens.length === 1) {
        // Plain pick value — use the selection's market
        return formatPickLabel(market, tokens[0] ?? part, t);
      }
      // "MARKET PICK" format embedded in the string
      const pickValue = tokens[tokens.length - 1] ?? "";
      const marketValue = tokens.slice(0, -1).join("_");
      return formatPickLabel(marketValue, pickValue, t);
    })
    .join(" + ");
}

export type Translations = (typeof locales)["fr"];

export function getLocale(param: string | null): Locale {
  return param === "en" ? "en" : "fr";
}
