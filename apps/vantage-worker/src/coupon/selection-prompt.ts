import {
  formatMarketForDisplayFr,
  formatPickForDisplayFr,
  type CouponBounds,
  type CouponClass,
} from "@evcore/analysis-core";
import type { ScoredCandidate } from "./score-candidates";

// One call per class (SAFE/BALANCED/BOLD) — see docs/vantage-centric-
// redesign-2026-09-01.md Phase B research note: constraint density degrades
// instruction-following, so each call carries exactly one leg-odds band and
// one target instead of three at once. Same French, same explicit-rules
// style as vantage/prompt.ts (VANTAGE's own prompt) — one voice across the
// whole system, not two prompt-writing conventions.
export function buildCouponSelectionSystemPrompt(
  couponClass: CouponClass,
  bounds: Pick<CouponBounds, "minLegs">,
): string {
  return `Tu composes un coupon EVCore de classe ${couponClass.name} — un ensemble de ${bounds.minLegs} à ${couponClass.maxLegs} paris combinés (un "coupon"), choisis parmi un vivier de candidats déjà validés et classés par le système.

Tu ne calcules RIEN toi-même : chaque candidat ci-dessous porte déjà sa probabilité calibrée et sa cote, calculées par le moteur déterministe. Ton rôle n'est PAS de vérifier ou recalculer ces chiffres — c'est de juger la COHÉRENCE de la combinaison : est-ce que ces jambes racontent une histoire qui se tient, ou se contredisent-elles ? Est-ce que le risque est réparti, ou tout concentré sur le même scénario ?

Règles strictes :
- Tu ne peux choisir QUE parmi les candidats numérotés ci-dessous, par leur numéro exact — jamais un numéro hors de la liste, jamais un candidat inventé.
- Toutes les jambes listées sont déjà dans la bande de cote propre à la classe ${couponClass.name} et ont déjà passé les garde-fous de fiabilité du système — tu n'as pas à revérifier leur cote ou leur probabilité individuellement, seulement leur cohérence ENSEMBLE.
- Ne choisis jamais deux jambes du même match (même "Match : X vs Y").
- Ne choisis jamais deux jambes du même canal sur le même marché (ex: deux jambes DOMINANT/ONE_X_TWO).
- Au maximum 2 jambes de la même compétition.
- Cible de cote combinée pour cette classe : environ ${couponClass.targetCombinedOdds} (indicatif — le calcul exact est refait et vérifié par le système après ton choix, tu n'as pas besoin d'une précision parfaite).
- Mélange de préférence quelques jambes "ancres" (probabilité calibrée élevée, ≥70%) avec quelques jambes "valeur" (probabilité plus modérée mais cote nettement plus longue) — jamais uniquement l'un ou l'autre, sauf si le vivier ne permet pas ce mélange.
- Si aucune combinaison cohérente n'émerge du vivier (candidats trop corrélés, aucune histoire qui se tient, ou vivier trop pauvre), réponds "no_coupon" avec une raison claire plutôt que de forcer un mélange arbitraire — comme pour un "no_play" VANTAGE, ne force jamais une réponse pour justifier ta présence.
- "reasoning" (par jambe) et "reasonDetails" (global) doivent expliquer le POURQUOI de la combinaison en langage naturel, jamais recopier les chiffres déjà donnés (probabilité, cote) — ces chiffres sont pour TON jugement, pas pour ta réponse.
- Réponds uniquement en JSON valide correspondant au schéma fourni. Aucun texte hors JSON.`;
}

function formatPct(probability: number): string {
  return `${(probability * 100).toFixed(0)}%`;
}

export function buildCouponSelectionUserPrompt(
  couponClass: CouponClass,
  pool: readonly ScoredCandidate[],
): string {
  const poolBlock = pool
    .map((c, i) => {
      const index = i + 1;
      const marketLabel = formatMarketForDisplayFr(c.market);
      const pickLabel = formatPickForDisplayFr(c.pick, c.market);
      const odds = c.oddsSnapshot !== null ? c.oddsSnapshot.toFixed(2) : "?";
      return `${index}. Match : ${c.homeTeam} vs ${c.awayTeam} (${c.competition}) — canal ${c.canal}, ${marketLabel} (${pickLabel}), probabilité calibrée ${formatPct(c.calibratedProbability)}, cote ${odds}`;
    })
    .join("\n");

  return `Vivier de candidats pour un coupon de classe ${couponClass.name} (cote de jambe ${couponClass.minLegOdds}-${couponClass.maxLegOdds}) :
${poolBlock}

Réponds avec l'un de ces deux schémas JSON exacts :
{"verdict":"no_coupon","reasonDetails":"..."}
{"verdict":"compose","reasonDetails":"...","legs":[{"index":<numéro exact de la liste ci-dessus>,"reasoning":"..."}, ...]}`;
}
