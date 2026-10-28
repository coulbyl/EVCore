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

/** Un badge « Planifié » sur chaque carte ne distingue rien : seuls les
 * statuts qui changent la lecture du match (terminé, en cours, reporté,
 * annulé) méritent un badge (revue UX du 2026-10-11, P2-15). */
export function fixtureStatusIsNotable(status: string): boolean {
  const s = status.toLowerCase();
  return (
    s === "finished" ||
    s === "in_progress" ||
    s === "postponed" ||
    s === "cancelled"
  );
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

/**
 * Le pari en clair, avec le nom des équipes : « Victoire Arsenal », « Burnley
 * ou nul », « Arsenal n'encaisse pas ». Le joueur lit un pari, pas un canal
 * (décision du 2026-10-27, docs/audits/2026-10-27/DECISIONS.md) : « Domicile »
 * l'obligeait à relier le mot à l'équipe de la ligne au-dessus, et Victoire
 * et Nul, deux canaux du même marché 1X2, se distinguent ici par l'issue.
 * Sans nom d'équipe, ou pour un marché sans équipe, retombe sur
 * formatPickForDisplay.
 */
export function formatPickWithTeams(
  pick: string,
  market: string,
  teams: { home: string; away: string } | null,
): string {
  if (!teams) return formatPickForDisplay(pick, market);
  const p = pick.includes(" ") ? pick.split(" ").slice(1).join("_") : pick;
  const { home, away } = teams;
  const side = (code: string): string | null =>
    code === "HOME" ? home : code === "AWAY" ? away : null;
  // « plus de 1,5 but », « plus de 2,5 buts » : singulier sous 2.
  const goals = (code: string, suffix = ""): string | null => {
    const label = formatGenericOverUnderPick(
      code === "OVER" ? "OVER_2_5" : code === "UNDER" ? "UNDER_2_5" : code,
    );
    if (!label) return null;
    const line = Number(label.replace(/^\D+/, ""));
    const unit = line < 2 ? "but" : "buts";
    return `${label.replace(".", ",")} ${unit}${suffix}`;
  };

  switch (market) {
    case "ONE_X_TWO":
    case "MATCH_WINNER":
      if (p === "DRAW") return "Match nul";
      return side(p)
        ? `Victoire ${side(p)}`
        : formatPickForDisplay(pick, market);
    case "DOUBLE_CHANCE":
      if (p === "1X") return `${home} ou nul`;
      if (p === "X2") return `${away} ou nul`;
      if (p === "12") return `${home} ou ${away}`;
      break;
    case "DRAW_NO_BET":
      if (side(p)) return `${side(p)}, remboursé si nul`;
      break;
    case "TO_WIN_EITHER_HALF":
      if (side(p)) return `${side(p)} gagne une mi-temps`;
      break;
    case "FIRST_HALF_WINNER":
      if (p === "DRAW") return "Égalité à la pause";
      if (side(p)) return `${side(p)} mène à la pause`;
      break;
    case "CLEAN_SHEET_HOME":
    case "CLEAN_SHEET_AWAY": {
      const team = market.endsWith("HOME") ? home : away;
      if (p === "YES") return `${team} n'encaisse pas`;
      if (p === "NO") return `${team} encaisse au moins un but`;
      break;
    }
    case "WIN_TO_NIL_HOME":
    case "WIN_TO_NIL_AWAY": {
      const team = market.endsWith("HOME") ? home : away;
      if (p === "YES") return `${team} gagne sans encaisser`;
      if (p === "NO") return `${team} ne gagne pas sans encaisser`;
      break;
    }
    case "TEAM_TOTAL_HOME":
    case "TEAM_TOTAL_AWAY": {
      const team = market.endsWith("HOME") ? home : away;
      const label = goals(p);
      if (label)
        return `${team} : ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
      break;
    }
    case "BTTS":
      if (p === "YES") return "Les deux équipes marquent";
      if (p === "NO") return "Au moins une équipe ne marque pas";
      break;
    case "OVER_UNDER":
    case "OVER_UNDER_25": {
      const label = goals(p);
      if (label) return label;
      break;
    }
    case "OVER_UNDER_HT": {
      const label = goals(p, " à la pause");
      if (label) return label;
      break;
    }
    case "CORRECT_SCORE": {
      const score = /^(\d+)[:-](\d+)$/.exec(p);
      if (score) return `${home} ${score[1]}–${score[2]} ${away}`;
      break;
    }
    case "RESULT_TOTAL_GOALS":
    case "RESULT_BTTS": {
      const match = /^(HOME|DRAW|AWAY)_(.+)$/.exec(p);
      if (!match) break;
      const [, code = "", rest = ""] = match;
      const result = code === "DRAW" ? "Match nul" : `Victoire ${side(code)}`;
      if (rest === "YES") return `${result} et les deux équipes marquent`;
      if (rest === "NO") return `${result} et une équipe ne marque pas`;
      const label = goals(rest);
      if (label)
        return `${result} et ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
      break;
    }
    case "HALF_TIME_FULL_TIME": {
      const [ht, ft] = p.split("_");
      const atHalf = (code: string | undefined) =>
        code === "DRAW" ? "égalité" : code ? `${side(code)} devant` : null;
      const atEnd = (code: string | undefined) =>
        code === "DRAW" ? "nul" : code ? `victoire ${side(code)}` : null;
      if (atHalf(ht) && atEnd(ft)) {
        return `${atHalf(ht)} à la pause, ${atEnd(ft)} à la fin`;
      }
      break;
    }
  }
  return formatPickForDisplay(pick, market);
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
