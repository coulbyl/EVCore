// Groupes d'issues par marché, pour retirer la marge d'un prix (chantier E).
//
// `fairProbabilities` (closing-line-value.ts) exige un groupe EXCLUSIF et
// EXHAUSTIF : toutes les issues qui se partagent la mise, et rien d'autre.
// Ce module dit, pour un (marché, choix), quelles lignes du book forment ce
// groupe et à combien leurs probabilités vraies somment (1 partout, 2 pour
// la double chance dont les trois issues couvrent chaque résultat deux fois).
//
// `null` quand aucun groupe propre n'existe : TO_WIN_EITHER_HALF (domicile
// et extérieur peuvent gagner chacun une mi-temps), CORRECT_SCORE (grille
// jamais complète chez un book), marchés à ligne dans la colonne `line`
// (handicap asiatique, corners, cartons) dont l'identité ne tient pas dans
// `pick`. Un CLV sur un groupe incomplet serait biaisé dans une direction
// inconnue : mieux vaut aucune valeur qu'une valeur fausse.

import { Market } from "../types";
import { HALF_TIME_FULL_TIME_PICKS } from "../probability/markets";

export type OutcomeGroup = {
  /** Toutes les issues du groupe, le choix demandé inclus. */
  picks: readonly string[];
  /** Somme des probabilités vraies du groupe : 1, sauf double chance (2). */
  outcomeTotal: number;
};

const THREE_WAY: readonly string[] = ["HOME", "DRAW", "AWAY"];
const HOME_AWAY: readonly string[] = ["HOME", "AWAY"];
const YES_NO: readonly string[] = ["YES", "NO"];
const DOUBLE_CHANCE: readonly string[] = ["1X", "X2", "12"];
const HALF_TIME_FULL_TIME: readonly string[] = HALF_TIME_FULL_TIME_PICKS;

const OVER_UNDER_PICK = /^(OVER|UNDER)(_\d+_\d+)?$/;
const RESULT_TOTAL_GOALS_PICK = /^(HOME|DRAW|AWAY)_(OVER|UNDER)_(\d+_\d+)$/;
const RESULT_BTTS_PICK = /^(HOME|DRAW|AWAY)_(YES|NO)$/;

function fixedGroup(
  picks: readonly string[],
  pick: string,
  outcomeTotal = 1,
): OutcomeGroup | null {
  return picks.includes(pick) ? { picks, outcomeTotal } : null;
}

// Une ligne de total est un marché binaire à part entière : OVER_1_5 ne
// partage sa mise qu'avec UNDER_1_5, jamais avec OVER_2_5. La ligne 2.5 vit
// sous les clés nues `OVER` / `UNDER` (cf. FullOddsSnapshot.overUnderOdds).
function overUnderGroup(pick: string): OutcomeGroup | null {
  const match = OVER_UNDER_PICK.exec(pick);
  if (!match) return null;
  const suffix = match[2] ?? "";
  return { picks: [`OVER${suffix}`, `UNDER${suffix}`], outcomeTotal: 1 };
}

// Résultat × total sur UNE ligne : six issues exclusives et exhaustives.
function resultTotalGoalsGroup(pick: string): OutcomeGroup | null {
  const match = RESULT_TOTAL_GOALS_PICK.exec(pick);
  if (!match) return null;
  const line = match[3];
  return {
    picks: THREE_WAY.flatMap((side) => [
      `${side}_OVER_${line}`,
      `${side}_UNDER_${line}`,
    ]),
    outcomeTotal: 1,
  };
}

function resultBttsGroup(pick: string): OutcomeGroup | null {
  if (!RESULT_BTTS_PICK.test(pick)) return null;
  return {
    picks: THREE_WAY.flatMap((side) => [`${side}_YES`, `${side}_NO`]),
    outcomeTotal: 1,
  };
}

/**
 * Groupe d'issues d'un (marché, choix), ou `null` si aucun groupe exclusif
 * et exhaustif n'existe pour ce marché, ou si le choix n'en fait pas partie.
 *
 * DRAW_NO_BET : les deux issues sont exclusives et exhaustives
 * CONDITIONNELLEMENT au non-nul (le nul rembourse) ; la probabilité sans
 * marge est donc conditionnelle, ce qui est exactement ce que paie le prix.
 */
export function outcomeGroup(
  market: Market,
  pick: string,
): OutcomeGroup | null {
  switch (market) {
    case Market.ONE_X_TWO:
    case Market.FIRST_HALF_WINNER:
      return fixedGroup(THREE_WAY, pick);
    case Market.DRAW_NO_BET:
      return fixedGroup(HOME_AWAY, pick);
    case Market.DOUBLE_CHANCE:
      return fixedGroup(DOUBLE_CHANCE, pick, 2);
    case Market.BTTS:
    case Market.CLEAN_SHEET_HOME:
    case Market.CLEAN_SHEET_AWAY:
    case Market.WIN_TO_NIL_HOME:
    case Market.WIN_TO_NIL_AWAY:
      return fixedGroup(YES_NO, pick);
    case Market.OVER_UNDER:
    case Market.OVER_UNDER_HT:
    case Market.TEAM_TOTAL_HOME:
    case Market.TEAM_TOTAL_AWAY:
      return overUnderGroup(pick);
    case Market.HALF_TIME_FULL_TIME:
      return fixedGroup(HALF_TIME_FULL_TIME, pick);
    case Market.RESULT_TOTAL_GOALS:
      return resultTotalGoalsGroup(pick);
    case Market.RESULT_BTTS:
      return resultBttsGroup(pick);
    default:
      return null;
  }
}
