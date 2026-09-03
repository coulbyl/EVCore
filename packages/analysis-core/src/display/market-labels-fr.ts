// French display labels for Market/pick codes — shared between apps/web
// (helpers/fixture.ts, which wraps these for its fr/en multi-locale API) and
// apps/vantage-worker (prompt.ts, so VANTAGE's own prose reads "moins de 2.5
// buts" instead of echoing the raw code "UNDER" it was fed — a model shown a
// code tends to repeat that code verbatim). Single source of truth: edit
// here, both consumers pick it up.
const MARKET_LABELS_FR: Record<string, string> = {
  ONE_X_TWO: "Résultat",
  MATCH_WINNER: "Vainqueur",
  BTTS: "Les deux marquent",
  OVER_UNDER: "Plus/Moins de buts",
  OVER_UNDER_25: "Plus/Moins de buts",
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
};

// Parses a generic "OVER_X_Y" / "UNDER_X_Y" pick (used by TEAM_TOTAL_* and
// other multi-line markets) into a French "Plus/Moins de X.Y" label. Returns
// null when the pick doesn't match the pattern (caller falls back to raw).
export function formatGenericOverUnderPick(pick: string): string | null {
  const match = /^(OVER|UNDER)_(\d+)_(\d+)$/.exec(pick);
  if (!match) return null;
  const [, side, whole, decimal] = match;
  const label = side === "OVER" ? "Plus de" : "Moins de";
  return `${label} ${whole}.${decimal}`;
}

export function formatMarketForDisplayFr(market: string): string {
  return (
    MARKET_LABELS_FR[market] ??
    market.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

export function formatPickForDisplayFr(pick: string, market: string): string {
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
      if (rest === "YES") return `${sideLabel} + BTTS Oui`;
      if (rest === "NO") return `${sideLabel} + BTTS Non`;
      const goalsLabel = formatGenericOverUnderPick(rest);
      if (goalsLabel) return `${sideLabel} + ${goalsLabel}`;
    }
  }

  return p;
}
