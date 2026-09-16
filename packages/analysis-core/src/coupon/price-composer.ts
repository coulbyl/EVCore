import Decimal from "decimal.js";

/**
 * Compositeur de coupon par le prix.
 *
 * POURQUOI UN SECOND COMPOSITEUR. `deterministic-composer` classe les jambes
 * sur la probabilité du moteur puis sur l'EV. Trois mesures interdisent de
 * continuer ainsi :
 *
 * - le moteur est derrière le marché de 0,04 de Brier, et son poids optimal
 *   dans un mélange avec le prix est nul : sa probabilité n'apporte aucune
 *   information au-delà de la cote ;
 * - la règle d'EV est un détecteur de surestimation — à cote égale elle retient
 *   les picks où le modèle se trompe le plus (−14,9 points de calibration) ;
 * - le couple championnat × marché ne persiste pas d'une période à l'autre
 *   (corrélation −0,022 sur 160 cellules) : « le bon marché sur le bon
 *   championnat » est un tirage au sort.
 *
 * Ce qui persiste, et fortement (corrélation +0,696 sur 17 marchés), c'est le
 * **coût** de chaque marché. Ce compositeur ne classe donc que sur du prix
 * mesuré, jamais sur une probabilité produite par nous.
 *
 * CE QU'IL FAIT. Il cherche la combinaison qui atteint la fourchette de cote
 * visée **au coût mesuré le plus faible**, sous contraintes de corrélation, et
 * il **refuse de composer** quand la meilleure combinaison du jour reste
 * au-dessous du plancher. Le refus est un résultat, pas un échec.
 */

/**
 * Une jambe candidate, prix en main.
 *
 * `expectedReturn` est le retour moyen d'une mise de 1 mesuré sur la cellule
 * (marché × tranche de cote) à laquelle la jambe appartient, calibré sur une
 * fenêtre **antérieure** à la journée composée. 0,956 se lit « ce marché coûte
 * 4,4 % ». Il ne doit jamais venir d'une probabilité du moteur : ce serait
 * réintroduire par la fenêtre le critère que ce module existe pour remplacer.
 */
export type PriceCandidate = {
  /** Identité de la rencontre — l'UUID du projet, jamais un index local. */
  readonly fixtureId: string;
  readonly competition: string;
  readonly market: string;
  readonly pick: string;
  readonly odds: number;
  readonly expectedReturn: number;
};

export type PriceComposerConfig = {
  readonly minOdds: number;
  readonly maxOdds: number;
  readonly minLegs: number;
  readonly maxLegs: number;
  /** Plafond par championnat : une journée de Ligue 1 pluvieuse touche toutes
   *  ses rencontres à la fois. */
  readonly maxPerCompetition: number;
  /** Retour attendu minimal du coupon entier. En dessous, on ne compose pas. */
  readonly minExpectedReturn: number;
};

export type ComposedCoupon = {
  readonly legs: readonly PriceCandidate[];
  readonly combinedOdds: Decimal;
  readonly expectedReturn: Decimal;
};

export type PriceCompositionResult =
  | { readonly outcome: "composed"; readonly coupon: ComposedCoupon }
  | {
      readonly outcome: "refused";
      readonly reason:
        | "no_candidates"
        | "target_unreachable"
        | "expected_return_too_low";
      /** Meilleur retour attendu atteignable, quand la cible était atteignable. */
      readonly bestExpectedReturn: Decimal | null;
    };

/**
 * Pas de discrétisation de la recherche, en log de cote. 0,01 vaut 1 % de cote :
 * plus fin ne change aucune décision et multiplie les états.
 */
const LOG_BUCKET = 0.01;
/** Marge de sécurité sur l'arrondi des paniers : la cote exacte est revérifiée. */
const BUCKET_SLACK = 3;
/**
 * Plafond de candidats retenus. La recherche est en O(candidats × jambes ×
 * paniers) ; au-delà, les jambes ajoutées sont de toute façon moins efficientes
 * que les 150 premières.
 */
const MAX_POOL = 150;

/**
 * Coût d'une jambe par unité de cote apportée.
 *
 * `log(expectedReturn)` est négatif, `log(odds)` positif : le rapport est
 * négatif et le meilleur candidat est celui le plus proche de zéro. C'est la
 * seule grandeur qui permette de comparer une jambe courte et une jambe longue.
 */
function efficiency(candidate: PriceCandidate): number {
  return Math.log(candidate.expectedReturn) / Math.log(candidate.odds);
}

function candidateKey(candidate: PriceCandidate): string {
  return `${candidate.fixtureId}:${candidate.market}:${candidate.pick}`;
}

/** Tri total : deux exécutions sur les mêmes données donnent le même coupon. */
function byEfficiencyThenKey(a: PriceCandidate, b: PriceCandidate): number {
  const delta = efficiency(b) - efficiency(a);
  if (Math.abs(delta) > 1e-12) return delta;
  return candidateKey(a) < candidateKey(b) ? -1 : 1;
}

function isUsable(candidate: PriceCandidate): boolean {
  return (
    Number.isFinite(candidate.odds) &&
    candidate.odds > 1 &&
    Number.isFinite(candidate.expectedReturn) &&
    candidate.expectedReturn > 0
  );
}

/**
 * Réduit le bassin aux jambes décorrélées : une seule par rencontre, et au plus
 * `maxPerCompetition` par championnat, les plus efficientes d'abord.
 *
 * Deux jambes d'une même rencontre ne sont pas indépendantes — les combiner
 * multiplie leurs cotes comme si elles l'étaient et fabrique une cote qui
 * n'existe pas.
 */
function decorrelate(
  candidates: readonly PriceCandidate[],
  maxPerCompetition: number,
): PriceCandidate[] {
  const bestPerFixture = new Map<string, PriceCandidate>();
  for (const candidate of candidates) {
    const held = bestPerFixture.get(candidate.fixtureId);
    if (!held || byEfficiencyThenKey(candidate, held) < 0) {
      bestPerFixture.set(candidate.fixtureId, candidate);
    }
  }
  const perCompetition = new Map<string, number>();
  const pool: PriceCandidate[] = [];
  for (const candidate of [...bestPerFixture.values()].sort(
    byEfficiencyThenKey,
  )) {
    const used = perCompetition.get(candidate.competition) ?? 0;
    if (used >= maxPerCompetition) continue;
    perCompetition.set(candidate.competition, used + 1);
    pool.push(candidate);
    if (pool.length >= MAX_POOL) break;
  }
  return pool;
}

type SearchState = { readonly cost: number; readonly legs: PriceCandidate[] };

/** Départage deux états de même coût sur la suite de clés, pour rester stable. */
function preferable(next: SearchState, held: SearchState | undefined): boolean {
  if (!held) return true;
  if (next.cost < held.cost - 1e-12) return true;
  if (next.cost > held.cost + 1e-12) return false;
  const a = next.legs.map(candidateKey).join("|");
  const b = held.legs.map(candidateKey).join("|");
  return a < b;
}

/**
 * Cherche la combinaison la moins coûteuse atteignant la fourchette de cote.
 *
 * Programmation dynamique sur (nombre de jambes, cote cumulée en log). Le coût
 * d'une jambe est `−log(expectedReturn)`, toujours positif : minimiser la somme
 * revient à maximiser le produit des retours attendus, c'est-à-dire le retour
 * attendu du coupon.
 */
export function composeByPrice(
  candidates: readonly PriceCandidate[],
  config: PriceComposerConfig,
): PriceCompositionResult {
  const pool = decorrelate(
    candidates.filter(isUsable),
    config.maxPerCompetition,
  );
  if (pool.length === 0) {
    return {
      outcome: "refused",
      reason: "no_candidates",
      bestExpectedReturn: null,
    };
  }

  const maxBucket =
    Math.ceil(Math.log(config.maxOdds) / LOG_BUCKET) + BUCKET_SLACK;
  let states = new Map<string, SearchState>([["0:0", { cost: 0, legs: [] }]]);

  for (const candidate of pool) {
    const grown = new Map(states);
    for (const [key, state] of states) {
      const [legCount = 0, bucket = 0] = key.split(":").map(Number);
      if (legCount >= config.maxLegs) continue;
      const nextBucket =
        bucket + Math.round(Math.log(candidate.odds) / LOG_BUCKET);
      if (nextBucket > maxBucket) continue;
      const next: SearchState = {
        cost: state.cost - Math.log(candidate.expectedReturn),
        legs: [...state.legs, candidate],
      };
      const nextKey = `${legCount + 1}:${nextBucket}`;
      if (preferable(next, grown.get(nextKey))) grown.set(nextKey, next);
    }
    states = grown;
  }

  // La cote exacte est recalculée ici : l'arrondi en paniers sert la recherche,
  // jamais la décision.
  let best: { state: SearchState; odds: Decimal } | null = null;
  for (const state of states.values()) {
    if (state.legs.length < config.minLegs) continue;
    const odds = state.legs.reduce(
      (product, leg) => product.times(leg.odds),
      new Decimal(1),
    );
    if (odds.lessThan(config.minOdds) || odds.greaterThan(config.maxOdds))
      continue;
    if (!best || state.cost < best.state.cost - 1e-12) best = { state, odds };
  }

  if (!best) {
    return {
      outcome: "refused",
      reason: "target_unreachable",
      bestExpectedReturn: null,
    };
  }

  const expectedReturn = best.state.legs.reduce(
    (product, leg) => product.times(leg.expectedReturn),
    new Decimal(1),
  );
  if (expectedReturn.lessThan(config.minExpectedReturn)) {
    return {
      outcome: "refused",
      reason: "expected_return_too_low",
      bestExpectedReturn: expectedReturn,
    };
  }

  return {
    outcome: "composed",
    coupon: { legs: best.state.legs, combinedOdds: best.odds, expectedReturn },
  };
}
