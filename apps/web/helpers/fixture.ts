import {
  formatGenericOverUnderPick,
  formatMarketForDisplayFr,
  formatPickForDisplayFr,
} from "@evcore/analysis-core";
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

// French labels live in @evcore/analysis-core (packages/analysis-core/src/
// display/market-labels-fr.ts) — shared with apps/vantage-worker, whose
// VANTAGE prompt uses the exact same map so its own prose reads "moins de
// 2.5 buts" instead of echoing the raw code it was fed. English stays local:
// vantage-worker never needs it.
const MARKET_LABELS_EN: Record<string, string> = {
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
};

export function formatMarketForDisplay(
  market: string,
  locale: LocalePickFormat = "fr",
): string {
  if (locale === "fr") return formatMarketForDisplayFr(market);
  return (
    MARKET_LABELS_EN[market] ??
    market.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

export function formatPickForDisplay(pick: string, market: string): string {
  return formatPickForDisplayFr(pick, market);
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
    if (pick === "YES") return "BTTS OUI";
    if (pick === "NO") return "BTTS NON";
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
      if (rest === "YES") return `${sideLabel} + BTTS OUI`;
      if (rest === "NO") return `${sideLabel} + BTTS NON`;
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
