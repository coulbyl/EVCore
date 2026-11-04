import {
  formatGenericOverUnderPick,
  formatMarketForDisplayFr,
  formatPickForDisplayFr,
} from "@evcore/analysis-core";
import type { FixturePickSnapshot } from "@/domains/fixture/types/fixture";
import type messages from "@/messages/fr.json";

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
 * The translator of the `betLabels` messages (getTranslations, useTranslations
 * or createTranslator): every bet a player reads is worded there, in his
 * language, never here.
 */
export type BetLabels = (
  key: BetLabelKey,
  values?: Record<string, string | number>,
) => string;

type BetLabelKey = keyof (typeof messages)["betLabels"];

/**
 * Un pari sur un marché à ligne en colonne (corners, lot 6) : « Plus de 9,5
 * corners ». Null pour un autre marché : l'appelant garde son libellé.
 */
export function formatLinePick(
  bet: { pick: string; market: string; line: number | null },
  t: BetLabels,
): string | null {
  const { pick, market, line } = bet;
  if (line === null || market !== "CORNERS") return null;
  if (pick === "OVER") return t("cornersOver", { line });
  if (pick === "UNDER") return t("cornersUnder", { line });
  return null;
}

/**
 * Les marchés relevés depuis le 03/11 (corners d'équipe, corners 1X2,
 * cartons, buteurs, tirs d'un joueur, 1X2 à une minute) et le total de
 * corners, en clair avec l'équipe ou le joueur : « Arsenal obtient plus de
 * 4,5 corners », « Saka marque », « Saka cadre au moins 2 tirs », « Arsenal
 * mène après 30 minutes ». La ligne telle que le book la cote, jamais
 * arrondie. Null pour un autre marché, ou quand le pari ne se lit pas (un
 * joueur sans nom, une ligne absente) : l'appelant garde son libellé.
 */
export function formatStatPick(
  bet: {
    market: string;
    pick: string;
    line?: number | null;
    player?: string | null;
  },
  teams: { home: string; away: string },
  t: BetLabels,
): string | null {
  const { market, pick } = bet;
  const line = bet.line ?? null;
  const player = bet.player ?? null;
  const side = (code: string): string | null =>
    code === "HOME" ? teams.home : code === "AWAY" ? teams.away : null;

  switch (market) {
    case "CORNERS":
      return formatLinePick({ pick, market, line }, t);
    case "CARDS":
      if (line === null) return null;
      if (pick === "OVER") return t("cardsOver", { line });
      if (pick === "UNDER") return t("cardsUnder", { line });
      return null;
    case "CORNERS_HOME":
    case "CORNERS_AWAY": {
      if (line === null) return null;
      const team = market === "CORNERS_HOME" ? teams.home : teams.away;
      if (pick === "OVER") return t("teamCornersOver", { team, line });
      if (pick === "UNDER") return t("teamCornersUnder", { team, line });
      return null;
    }
    case "CORNERS_1X2": {
      if (pick === "DRAW") return t("sameCorners");
      const team = side(pick);
      return team === null ? null : t("moreCorners", { team });
    }
    case "MINUTE_1X2": {
      if (line === null) return null;
      if (pick === "DRAW") return t("levelAfter", { minute: line });
      const team = side(pick);
      return team === null ? null : t("leadsAfter", { team, minute: line });
    }
    case "GOAL_SCORER_ANYTIME":
      return player === null ? null : t("scorer", { player });
    case "GOAL_SCORER_FIRST":
      if (pick === "NONE") return t("noScorer");
      return player === null ? null : t("firstScorer", { player });
    case "PLAYER_SHOTS":
    case "PLAYER_SHOTS_ON_TARGET":
      if (player === null || line === null) return null;
      return t(market === "PLAYER_SHOTS" ? "shots" : "shotsOnTarget", {
        player,
        line,
      });
    default:
      return null;
  }
}

/** « OVER_2_5 » → { over: true, line: 2.5 }; the bare OVER/UNDER is 2.5. */
function overUnderOf(code: string): { over: boolean; line: number } | null {
  if (code === "OVER" || code === "UNDER") {
    return { over: code === "OVER", line: 2.5 };
  }
  const match = /^(OVER|UNDER)_(\d+)_(\d+)$/.exec(code);
  if (!match) return null;
  return {
    over: match[1] === "OVER",
    line: Number(`${match[2]}.${match[3]}`),
  };
}

/**
 * Le pari en clair, avec le nom des équipes : « Victoire Arsenal », « Burnley
 * ou nul », « Arsenal n'encaisse pas », « Rennes marque moins de 2,5 buts ».
 * Le joueur lit un pari, pas un canal (décision du 2026-10-27,
 * docs/audits/2026-10-27/DECISIONS.md) : « Domicile » l'obligeait à relier
 * le mot à l'équipe de la ligne au-dessus, et Victoire et Nul, deux canaux du
 * même marché 1X2, se distinguent ici par l'issue. Les lignes telles que le
 * book les cote, jamais arrondies. Sans nom d'équipe, ou pour un marché sans
 * équipe, retombe sur formatPickForDisplay.
 */
export function formatPickWithTeams(
  bet: { pick: string; market: string },
  teams: { home: string; away: string } | null,
  t: BetLabels,
): string {
  const { pick, market } = bet;
  if (!teams) return formatPickForDisplay(pick, market);
  const p = pick.includes(" ") ? pick.split(" ").slice(1).join("_") : pick;
  const { home, away } = teams;
  const side = (code: string | undefined): string | null =>
    code === "HOME" ? home : code === "AWAY" ? away : null;
  const goals = (
    code: string,
    keys: [BetLabelKey, BetLabelKey],
  ): string | null => {
    const ou = overUnderOf(code);
    return ou ? t(ou.over ? keys[0] : keys[1], { line: ou.line }) : null;
  };

  switch (market) {
    case "ONE_X_TWO":
    case "MATCH_WINNER": {
      if (p === "DRAW") return t("draw");
      const team = side(p);
      return team ? t("win", { team }) : formatPickForDisplay(pick, market);
    }
    case "DOUBLE_CHANCE":
      if (p === "1X") return t("teamOrDraw", { team: home });
      if (p === "X2") return t("teamOrDraw", { team: away });
      // « A ou B » read as a doubt between two teams: it is « no draw ».
      if (p === "12") return t("noDraw");
      break;
    case "DRAW_NO_BET": {
      const team = side(p);
      if (team) return t("drawNoBet", { team });
      break;
    }
    case "TO_WIN_EITHER_HALF": {
      const team = side(p);
      if (team) return t("winsAHalf", { team });
      break;
    }
    case "FIRST_HALF_WINNER": {
      if (p === "DRAW") return t("levelAtHalf");
      const team = side(p);
      if (team) return t("leadsAtHalf", { team });
      break;
    }
    case "CLEAN_SHEET_HOME":
    case "CLEAN_SHEET_AWAY": {
      const team = market.endsWith("HOME") ? home : away;
      if (p === "YES") return t("cleanSheet", { team });
      if (p === "NO") return t("concedes", { team });
      break;
    }
    case "WIN_TO_NIL_HOME":
    case "WIN_TO_NIL_AWAY": {
      const team = market.endsWith("HOME") ? home : away;
      if (p === "YES") return t("winToNil", { team });
      if (p === "NO") return t("noWinToNil", { team });
      break;
    }
    case "TEAM_TOTAL_HOME":
    case "TEAM_TOTAL_AWAY": {
      const team = market.endsWith("HOME") ? home : away;
      // A sentence, never « Rennes : moins de 2,5 buts », which read like
      // the match's own total just below it (04/11). The 0,5 line in words.
      if (p === "OVER_0_5") return t("teamScores", { team });
      if (p === "UNDER_0_5") return t("teamNoScore", { team });
      const ou = overUnderOf(p);
      if (ou) {
        return t(ou.over ? "teamOver" : "teamUnder", { team, line: ou.line });
      }
      break;
    }
    case "BTTS":
      if (p === "YES") return t("bttsYes");
      if (p === "NO") return t("bttsNo");
      break;
    case "OVER_UNDER":
    case "OVER_UNDER_25": {
      const label = goals(p, ["over", "under"]);
      if (label) return label;
      break;
    }
    case "OVER_UNDER_HT": {
      const label = goals(p, ["overAtHalf", "underAtHalf"]);
      if (label) return label;
      break;
    }
    case "CORRECT_SCORE": {
      const score = /^(\d+)[:-](\d+)$/.exec(p);
      if (score) {
        return t("correctScore", {
          home,
          away,
          homeGoals: score[1] ?? "",
          awayGoals: score[2] ?? "",
        });
      }
      break;
    }
    case "RESULT_TOTAL_GOALS":
    case "RESULT_BTTS": {
      const match = /^(HOME|DRAW|AWAY)_(.+)$/.exec(p);
      if (!match) break;
      const [, code = "", rest = ""] = match;
      const team = side(code);
      const result = team ? t("win", { team }) : t("draw");
      if (rest === "YES") return t("resultBttsYes", { result });
      if (rest === "NO") return t("resultBttsNo", { result });
      const ou = overUnderOf(rest);
      if (ou) {
        return t(ou.over ? "resultOver" : "resultUnder", {
          result,
          line: ou.line,
        });
      }
      break;
    }
    case "HALF_TIME_FULL_TIME": {
      const [ht, ft] = p.split("_");
      const halfTeam = side(ht);
      const endTeam = side(ft);
      const half =
        ht === "DRAW"
          ? t("halfLevel")
          : halfTeam
            ? t("halfAhead", { team: halfTeam })
            : null;
      const end =
        ft === "DRAW"
          ? t("endDraw")
          : endTeam
            ? t("endWin", { team: endTeam })
            : null;
      if (half && end) return t("halfTimeFullTime", { half, end });
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
