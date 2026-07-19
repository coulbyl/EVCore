import type { FixturePickSnapshot } from "@/domains/fixture/types/fixture";

type Locale = "fr" | "en";

const FIXTURE_STATUS_LABELS: Record<Locale, Record<string, string>> = {
  fr: {
    finished: "Terminé",
    in_progress: "En cours",
    postponed: "Reporté",
    cancelled: "Annulé",
    default: "Planifié",
  },
  en: {
    finished: "Finished",
    in_progress: "In progress",
    postponed: "Postponed",
    cancelled: "Cancelled",
    default: "Scheduled",
  },
};

export function fixtureStatusLabel(
  status: string,
  locale: Locale = "fr",
): string {
  const s = status.toLowerCase();
  const labels = FIXTURE_STATUS_LABELS[locale];
  return labels[s] ?? labels["default"] ?? s;
}

export function fixtureStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "finished")
    return "border-border bg-secondary text-muted-foreground";
  if (s === "in_progress") return "border-accent/20 bg-accent-soft text-accent";
  if (s === "postponed" || s === "cancelled")
    return "border-destructive/20 bg-destructive/10 text-destructive";
  return "border-warning/20 bg-warning/12 text-warning";
}

type LocalePickFormat = "fr" | "en";

const MARKET_LABELS: Record<LocalePickFormat, Record<string, string>> = {
  fr: {
    ONE_X_TWO: "Résultat",
    MATCH_WINNER: "Vainqueur",
    BTTS: "Les deux marquent",
    OVER_UNDER: "Plus/Moins",
    OVER_UNDER_25: "Plus/Moins",
    DOUBLE_CHANCE: "Double chance",
    HALF_TIME_FULL_TIME: "Mi-temps / Fin de match",
    OVER_UNDER_HT: "Plus/Moins MT",
    FIRST_HALF_WINNER: "Résultat MT",
    CORRECT_SCORE: "Score exact",
    DRAW_NO_BET: "Sans le nul",
    TEAM_TOTAL_HOME: "Buts domicile",
    TEAM_TOTAL_AWAY: "Buts extérieur",
    CLEAN_SHEET_HOME: "Clean sheet domicile",
    CLEAN_SHEET_AWAY: "Clean sheet extérieur",
    WIN_TO_NIL_HOME: "Gagne sans encaisser (dom.)",
    WIN_TO_NIL_AWAY: "Gagne sans encaisser (ext.)",
    TO_WIN_EITHER_HALF: "Gagne une mi-temps",
    RESULT_TOTAL_GOALS: "Résultat + total buts",
    RESULT_BTTS: "Résultat + BTTS",
  },
  en: {
    ONE_X_TWO: "Result",
    MATCH_WINNER: "Match Winner",
    BTTS: "Both Teams Score",
    OVER_UNDER: "Over/Under",
    OVER_UNDER_25: "Over/Under",
    DOUBLE_CHANCE: "Double Chance",
    HALF_TIME_FULL_TIME: "Half Time / Full Time",
    OVER_UNDER_HT: "Over/Under HT",
    FIRST_HALF_WINNER: "HT Result",
    CORRECT_SCORE: "Correct Score",
    DRAW_NO_BET: "Draw No Bet",
    TEAM_TOTAL_HOME: "Home Team Goals",
    TEAM_TOTAL_AWAY: "Away Team Goals",
    CLEAN_SHEET_HOME: "Home Clean Sheet",
    CLEAN_SHEET_AWAY: "Away Clean Sheet",
    WIN_TO_NIL_HOME: "Home Win to Nil",
    WIN_TO_NIL_AWAY: "Away Win to Nil",
    TO_WIN_EITHER_HALF: "To Win Either Half",
    RESULT_TOTAL_GOALS: "Result & Total Goals",
    RESULT_BTTS: "Result & BTTS",
  },
};

// Parses a generic "OVER_X_Y" / "UNDER_X_Y" pick (used by TEAM_TOTAL_* and
// other multi-line markets) into a French "Plus/Moins de X.Y" label. Returns
// null when the pick doesn't match the pattern (caller falls back to raw).
function formatGenericOverUnderPick(pick: string): string | null {
  const match = /^(OVER|UNDER)_(\d+)_(\d+)$/.exec(pick);
  if (!match) return null;
  const [, side, whole, decimal] = match;
  const label = side === "OVER" ? "Plus de" : "Moins de";
  return `${label} ${whole}.${decimal}`;
}

export function formatMarketForDisplay(
  market: string,
  locale: LocalePickFormat = "fr",
): string {
  return (
    MARKET_LABELS[locale][market] ??
    market.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

export function formatPickForDisplay(pick: string, market: string): string {
  // Normalise : retire le préfixe marché si concaténé (ex: "OVER_UNDER OVER_1_5" → "OVER_1_5")
  const p = pick.includes(" ") ? pick.split(" ").slice(1).join("_") : pick;

  if (market === "ONE_X_TWO" || market === "MATCH_WINNER") {
    if (p === "HOME") return "Domicile";
    if (p === "DRAW") return "Nul";
    if (p === "AWAY") return "Extérieur";
  }

  if (market === "BTTS") {
    if (p === "YES") return "Oui";
    if (p === "NO") return "Non";
  }

  if (market === "DOUBLE_CHANCE") {
    if (p === "1X") return "Dom. ou Nul";
    if (p === "X2") return "Nul ou Ext.";
    if (p === "12") return "Dom. ou Ext.";
  }

  if (market === "OVER_UNDER" || market === "OVER_UNDER_25") {
    if (p === "OVER_1_5") return "Plus de 1.5";
    if (p === "UNDER_1_5") return "Moins de 1.5";
    if (p === "OVER") return "Plus de 2.5";
    if (p === "UNDER") return "Moins de 2.5";
    if (p === "OVER_3_5") return "Plus de 3.5";
    if (p === "UNDER_3_5") return "Moins de 3.5";
    if (p === "OVER_4_5") return "Plus de 4.5";
    if (p === "UNDER_4_5") return "Moins de 4.5";
  }

  if (market === "OVER_UNDER_HT") {
    if (p === "OVER_0_5") return "Plus de 0.5 MT";
    if (p === "UNDER_0_5") return "Moins de 0.5 MT";
    if (p === "OVER_1_5") return "Plus de 1.5 MT";
    if (p === "UNDER_1_5") return "Moins de 1.5 MT";
  }

  if (market === "FIRST_HALF_WINNER") {
    if (p === "HOME") return "Domicile MT";
    if (p === "DRAW") return "Nul MT";
    if (p === "AWAY") return "Extérieur MT";
  }

  if (market === "HALF_TIME_FULL_TIME") {
    const htftLabels: Record<string, string> = {
      HOME_HOME: "Dom. / Dom.",
      HOME_DRAW: "Dom. / Nul",
      HOME_AWAY: "Dom. / Ext.",
      DRAW_HOME: "Nul / Dom.",
      DRAW_DRAW: "Nul / Nul",
      DRAW_AWAY: "Nul / Ext.",
      AWAY_HOME: "Ext. / Dom.",
      AWAY_DRAW: "Ext. / Nul",
      AWAY_AWAY: "Ext. / Ext.",
    };
    return htftLabels[p] ?? p;
  }

  if (market === "DRAW_NO_BET" || market === "TO_WIN_EITHER_HALF") {
    if (p === "HOME") return "Domicile";
    if (p === "AWAY") return "Extérieur";
  }

  if (
    market === "CLEAN_SHEET_HOME" ||
    market === "CLEAN_SHEET_AWAY" ||
    market === "WIN_TO_NIL_HOME" ||
    market === "WIN_TO_NIL_AWAY"
  ) {
    if (p === "YES") return "Oui";
    if (p === "NO") return "Non";
  }

  if (market === "TEAM_TOTAL_HOME" || market === "TEAM_TOTAL_AWAY") {
    return formatGenericOverUnderPick(p) ?? p;
  }

  if (market === "RESULT_TOTAL_GOALS" || market === "RESULT_BTTS") {
    const sideMatch = /^(HOME|DRAW|AWAY)_(.+)$/.exec(p);
    const side = sideMatch?.[1];
    const rest = sideMatch?.[2];
    if (side && rest) {
      const sideLabel =
        side === "HOME" ? "Dom." : side === "AWAY" ? "Ext." : "Nul";
      if (rest === "YES") return `${sideLabel} + BB Oui`;
      if (rest === "NO") return `${sideLabel} + BB Non`;
      const goalsLabel = formatGenericOverUnderPick(rest);
      if (goalsLabel) return `${sideLabel} + ${goalsLabel}`;
    }
  }

  return p;
}

export function formatDiagnosticPickForDisplay(
  market: string,
  pick: string,
): string {
  if (market === "ONE_X_TWO" || market === "MATCH_WINNER") {
    if (pick === "HOME") return "V1";
    if (pick === "DRAW") return "Nul";
    if (pick === "AWAY") return "V2";
  }

  if (market === "BTTS") {
    if (pick === "YES") return "BB OUI";
    if (pick === "NO") return "BB NON";
  }

  if (market === "FIRST_HALF_WINNER") {
    if (pick === "HOME") return "Dom. MT";
    if (pick === "DRAW") return "Nul MT";
    if (pick === "AWAY") return "Ext. MT";
  }

  if (market === "DOUBLE_CHANCE") {
    if (pick === "1X") return "Dom. ou Nul";
    if (pick === "X2") return "Nul ou Ext.";
    if (pick === "12") return "Dom. ou Ext.";
  }

  if (market === "OVER_UNDER" || market === "OVER_UNDER_25") {
    if (pick === "OVER") return "Plus de 2.5";
    if (pick === "UNDER") return "Moins de 2.5";
    if (pick === "OVER_1_5") return "Plus de 1.5";
    if (pick === "UNDER_1_5") return "Moins de 1.5";
    if (pick === "OVER_3_5") return "Plus de 3.5";
    if (pick === "UNDER_3_5") return "Moins de 3.5";
    if (pick === "OVER_4_5") return "Plus de 4.5";
    if (pick === "UNDER_4_5") return "Moins de 4.5";
  }

  if (market === "OVER_UNDER_HT") {
    if (pick === "OVER_0_5") return "Plus de 0.5 MT";
    if (pick === "UNDER_0_5") return "Moins de 0.5 MT";
    if (pick === "OVER_1_5") return "Plus de 1.5 MT";
    if (pick === "UNDER_1_5") return "Moins de 1.5 MT";
  }

  if (market === "HALF_TIME_FULL_TIME") {
    const htftLabels: Record<string, string> = {
      HOME_HOME: "V1 / V1",
      HOME_DRAW: "V1 / Nul",
      HOME_AWAY: "V1 / V2",
      DRAW_HOME: "Nul / V1",
      DRAW_DRAW: "Nul / Nul",
      DRAW_AWAY: "Nul / V2",
      AWAY_HOME: "V2 / V1",
      AWAY_DRAW: "V2 / Nul",
      AWAY_AWAY: "V2 / V2",
    };
    return htftLabels[pick] ?? pick;
  }

  if (market === "DRAW_NO_BET" || market === "TO_WIN_EITHER_HALF") {
    if (pick === "HOME") return "V1";
    if (pick === "AWAY") return "V2";
  }

  if (
    market === "CLEAN_SHEET_HOME" ||
    market === "CLEAN_SHEET_AWAY" ||
    market === "WIN_TO_NIL_HOME" ||
    market === "WIN_TO_NIL_AWAY"
  ) {
    if (pick === "YES") return "OUI";
    if (pick === "NO") return "NON";
  }

  if (market === "TEAM_TOTAL_HOME" || market === "TEAM_TOTAL_AWAY") {
    return formatGenericOverUnderPick(pick) ?? pick;
  }

  if (market === "RESULT_TOTAL_GOALS" || market === "RESULT_BTTS") {
    const sideMatch = /^(HOME|DRAW|AWAY)_(.+)$/.exec(pick);
    const side = sideMatch?.[1];
    const rest = sideMatch?.[2];
    if (side && rest) {
      const sideLabel = side === "HOME" ? "V1" : side === "AWAY" ? "V2" : "Nul";
      if (rest === "YES") return `${sideLabel} + BB OUI`;
      if (rest === "NO") return `${sideLabel} + BB NON`;
      const goalsLabel = formatGenericOverUnderPick(rest);
      if (goalsLabel) return `${sideLabel} + ${goalsLabel}`;
    }
  }

  return pick.replace(/_/g, " ");
}

export function formatCombinedPickForDisplay(
  snapshot: Pick<FixturePickSnapshot, "market" | "pick">,
): string {
  return formatDiagnosticPickForDisplay(snapshot.market, snapshot.pick);
}
