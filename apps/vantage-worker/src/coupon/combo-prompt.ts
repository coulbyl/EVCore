import {
  COMBO_COUPON_CLASS,
  formatMarketForDisplayFr,
  formatPickForDisplayFr,
} from "@evcore/analysis-core";
import type { ScoredCandidate } from "./score-candidates";

/**
 * Le combiné « Analyse IA » : le modèle choisit TROIS jambes dans la liste
 * des sélections éligibles — celles que le combiné du moteur prendrait
 * aussi (calibrées sur la compétition, cote courte, une par match). Il ne
 * voit ni probabilité ni cote : mesuré le 2026-10-13, la consigne « mélanger
 * des ancres et des jambes de valeur » lui faisait choisir les jambes les
 * plus surestimées (0,83 de l'annoncé réalisé contre 0,99 pour les mêmes
 * sélections prises par le prix). Son seul rôle est l'indépendance et la
 * cohérence des trois matchs ; le prix et la calibration ont déjà filtré.
 */
export const COMBO_LLM_LEGS = COMBO_COUPON_CLASS.maxLegs;

export function buildComboSystemPrompt(): string {
  return `Tu composes le combiné du jour d'EVCore : exactement ${COMBO_LLM_LEGS} paris sur ${COMBO_LLM_LEGS} matchs différents, choisis dans une liste de sélections déjà validées par le système (fiabilité mesurée, cote courte).

Règles :
1. Tu choisis uniquement par numéro dans la liste. Exactement ${COMBO_LLM_LEGS} numéros, tous différents.
2. Trois matchs différents, trois championnats différents. Préfère des matchs dont les issues ne dépendent pas les unes des autres (championnats, horaires, types de pari variés).
3. Tu ne vois ni cote ni probabilité, et tu n'en inventes pas : elles sont déjà jugées. Ne raisonne jamais en gains, en valeur ou en risque financier.
4. Si moins de ${COMBO_LLM_LEGS} matchs te paraissent indépendants et cohérents, réponds "no_coupon" avec la raison, sans forcer.
5. "reasoning" (par jambe, une phrase) et "reasonDetails" (global, deux phrases maximum) s'adressent à un joueur : pourquoi ces trois matchs ensemble. En français. Aucun code technique (ni nom de marché ni nom de canal en majuscules ou avec un underscore), aucun chiffre de cote ni de probabilité.
6. Réponds uniquement en JSON valide correspondant au schéma fourni. Aucun texte hors JSON.`;
}

export function buildComboUserPrompt(
  eligible: readonly ScoredCandidate[],
  feedback: string | null = null,
): string {
  const list = eligible
    .map((c, i) => {
      const market = formatMarketForDisplayFr(c.market);
      const pick = formatPickForDisplayFr(c.pick, c.market);
      const kickoff = c.scheduledAt.toISOString().slice(11, 16);
      return `${i + 1}. ${c.homeTeam} vs ${c.awayTeam} (${c.competition}, ${kickoff} UTC) — ${market} : ${pick}`;
    })
    .join("\n");
  const feedbackBlock = feedback
    ? `\nTa proposition précédente a été refusée par la vérification automatique : ${feedback}. Propose une combinaison différente qui corrige ce point.\n`
    : "";
  return `Sélections éligibles du jour :
${list}
${feedbackBlock}
Réponds avec l'un de ces deux schémas JSON exacts :
{"verdict":"no_coupon","reasonDetails":"..."}
{"verdict":"compose","reasonDetails":"...","legs":[{"index":<numéro>,"reasoning":"..."},{"index":<numéro>,"reasoning":"..."},{"index":<numéro>,"reasoning":"..."}]}`;
}
