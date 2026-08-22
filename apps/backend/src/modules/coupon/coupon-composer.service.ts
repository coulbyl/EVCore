import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { VALUE_MIN_EDGE } from '@evcore/analysis-core';
import { productDecimal } from '@utils/decimal.utils';
import { calculateEV } from '@modules/betting-engine/betting-engine.utils';
import { getValueMinEdge } from '@modules/betting-engine/ev.constants';
import {
  COUPON_PARAMS,
  COUPON_BOUNDS,
  MAX_LEG_EDGE,
  MIN_LEG_ODDS,
  type CouponBounds,
} from './coupon.constants';
import {
  applyReliability,
  type ChannelReliability,
  type ChannelReliabilityMap,
} from '@modules/adjustment/channel-reliability';
import type { LegCalibration, ScoredPick } from './signal-window.service';

const MIN_DISTINCT_FIXTURES = 2;
const MAX_POOL_SIZE = 25;

export type ComposedCoupon = {
  rank: number;
  legs: ScoredPick[];
  combinedOdds: number;
  /** Produit brut des probas par jambe, avant shrinkage (voir `jointProbability`). */
  rawJointProbability: number;
  jointProbability: number;
  /** EV du coupon : `P_coupon × Odd_coupon − 1` (cf. DESIGN.md Étape 1). */
  couponEV: number;
  signalScore: number;
  reasoning: Record<string, unknown>;
};

// jointProbability was previously the product of canal-level calibrated hit
// rates only — every coupon with the same canal mix stored the identical value
// (audit 2026-06-11: six pending coupons all at 0.4743 = SAFE rate × BTTS rate),
// making the viability filter and the jointProbability sort degenerate among
// same-canal combos. Blending each pick's model probability with its canal
// calibrated rate keeps the calibration tempering (raw model probabilities are
// over-confident) while restoring pick-specific joint probabilities.
export const LEG_PROBABILITY_MODEL_WEIGHT = 0.5;

export function calibratedLegProbability(leg: {
  probability: number;
  calibratedHitRate: number;
}): number {
  return (
    leg.probability * LEG_PROBABILITY_MODEL_WEIGHT +
    leg.calibratedHitRate * (1 - LEG_PROBABILITY_MODEL_WEIGHT)
  );
}

// Per-leg probability calibration — applies the leg's OWN channel reliability
// curve (Platt on the logit scale, see channel-reliability.ts).
//
// Replaces a per-market mean-error shift (`marketCalibration[market].meanError`,
// subtracted from the raw probability) that was wrong in two ways, both
// measured 2026-08-22:
//
//   1. Wrong SHAPE. The reliability curve is flatter than the diagonal, not
//      offset from it: announced 0.46 -> 0.81 while realised moves only
//      0.46 -> 0.59. A constant shift under-corrects the top of the range and
//      over-corrects the bottom, whatever value it takes.
//   2. Wrong GROUPING. The bias is channel-specific (realised/announced from
//      1.016 for DRAW to 0.623 for RESULT_BTTS), and a market-pooled figure
//      averages channels that need opposite corrections. Grouping by channel
//      also subsumes the market grouping in practice, since a channel owns one
//      or two markets.
//
// A channel with little settled history is shrunk toward the pooled curve in
// proportion to its sample size rather than dropped to a fallback, so there is
// no cliff and no "uncalibrated" branch left (see shrinkTowardPooled).
export function calibrateLegProbability(
  leg: { probability: number; canal: string },
  window: {
    channelReliability: ChannelReliabilityMap;
    pooledReliability: ChannelReliability;
  },
): number {
  const reliability =
    window.channelReliability[leg.canal] ?? window.pooledReliability;
  const calibrated = applyReliability(leg.probability, reliability);
  return Math.min(
    COUPON_PARAMS.capMax,
    Math.max(COUPON_PARAMS.capMin, calibrated),
  );
}

// Single source of truth for a leg's probability inside a coupon: the calibrated
// value when scoring has run, otherwise the legacy blend (keeps `compose()`
// correct even when called without a prior `scorePicks`, e.g. in unit tests).
export function legProbability(leg: {
  calibratedProbability?: number | null;
  probability: number;
  calibratedHitRate: number;
}): number {
  return leg.calibratedProbability ?? calibratedLegProbability(leg);
}

// Depth tie-break — NOT a probability/EV weight (db:backtest:coupon-quality-
// signals still shows train n=0 on these three signals as of 2026-08-15, so
// they can't be calibrated into signalScore yet). Used only to order
// otherwise-similar picks — same "pure ordering policy, no backtest needed"
// category as comparePicksBySignalThenProbability itself. Higher is better:
// offensiveBalance BALANCED > unknown (null) > ASYMMETRIC > STRONGLY_ASYMMETRIC;
// shadowConflict false (no conflict) > unknown (null) > true; more prior
// analyses of this exact (market, pick) preferred, capped so it can't dominate
// the other two components.
export function depthRank(pick: {
  offensiveBalance: 'BALANCED' | 'ASYMMETRIC' | 'STRONGLY_ASYMMETRIC' | null;
  shadowConflict: boolean | null;
  priorAnalysisCount: number;
}): number {
  const offensiveBalanceRank =
    pick.offensiveBalance === 'BALANCED'
      ? 2
      : pick.offensiveBalance === null
        ? 1
        : pick.offensiveBalance === 'ASYMMETRIC'
          ? 0
          : -1; // STRONGLY_ASYMMETRIC
  const shadowConflictRank =
    pick.shadowConflict === false ? 1 : pick.shadowConflict === null ? 0 : -1;
  return (
    offensiveBalanceRank * 4 +
    shadowConflictRank * 2 +
    Math.min(pick.priorAnalysisCount, 5) * 0.1
  );
}

// Candidate pool: the day's legs sorted by their own calibrated probability,
// cut to `poolSize`.
//
// Replaces an anchor/value mix that split the pool in half between legs above
// and below ANCHOR_MIN_PROBABILITY, ranked the value half by capped EV, and
// applied a per-competition cap. That policy was written for an EV-ranked
// composer and was never backtested (its own comment said none was needed).
// With the composer now selecting by probability, sorting by probability puts
// the "anchors" first anyway, and the EV ranking it used for the other half is
// the exact signal the 2026-08-22 measurements disqualified.
//
// Per-competition diversity is not enforced here any more: it is enforced
// where it matters, inside a coupon (violatesAntiCorrelation, 2 per
// competition). A pool-level cap only shrank the choice available to the
// search — it throttled the pool on 81 of 108 days at its old value of 2.
function buildCandidatePool(
  pricedPicks: ScoredPick[],
  poolSize: number,
): ScoredPick[] {
  return [...pricedPicks]
    .sort((a, b) => legProbability(b) - legProbability(a))
    .slice(0, poolSize);
}

// VALUE-only edge floor, mirroring the standalone VALUE channel's own gate
// (`selectBestViablePick` in analysis-core: probability − 1/odds ≥
// getValueMinEdge(league) ?? VALUE_MIN_EDGE=0.10). Before this, a VALUE leg
// that would be REJECTED as a standalone VALUE pick could still ride into a
// coupon whenever a partner leg's EV compensated for it at the combined-coupon
// level — audit 2026-08-01 found COUPON_ALL subscriptions at 0/19 settled
// wins. SAFE/BTTS/... legs are unaffected: VALUE_MIN_EDGE is deliberately
// VALUE-only, same as in the channel strategy.
// ⚠️ Inatteignable en production depuis le 2026-08-22, gardé pour la valeur
// documentaire du constat : (1) VALUE ne fait plus partie du pool
// (POOL_EXCLUDED_CHANNELS — c'est un filtre Phase 2, 89.5% de ses sélections
// dupliquent un pick Phase 1) ; (2) même s'il y revenait, exiger `edge >=
// VALUE_MIN_EDGE = 0.10` est le complémentaire exact de MAX_LEG_EDGE <= 0.10,
// donc aucune jambe VALUE ne peut satisfaire les deux.
//
// Ce n'est pas une coïncidence de seuils, c'est le résultat central de la
// mesure : la région que VALUE sélectionne (forte divergence modèle↔marché)
// est précisément celle où le modèle réalise 0.694 de ce qu'il annonce, contre
// 0.954 en dessous. La stratégie VALUE cherche la value là où le modèle n'a
// pas d'information.
export function clearsValueEdgeFloor(
  leg: {
    canal: string;
    calibratedProbability: number | null;
    oddsSnapshot: number | null;
    featureSnapshot: Record<string, unknown>;
  },
  getMinEdge: (
    competitionCode: string | null,
  ) => Decimal | undefined = getValueMinEdge,
): boolean {
  if (leg.canal !== 'VALUE') return true;
  if (leg.calibratedProbability === null || leg.oddsSnapshot === null) {
    return false;
  }
  const competitionCode =
    (leg.featureSnapshot['competitionCode'] as string | undefined) ?? null;
  const minEdge = getMinEdge(competitionCode) ?? VALUE_MIN_EDGE;
  const edge = new Decimal(leg.calibratedProbability).minus(
    new Decimal(1).div(leg.oddsSnapshot),
  );
  return edge.greaterThanOrEqualTo(minEdge);
}

// Rejects a leg whose model↔market divergence is beyond the range where the
// model has been measured reliable — see MAX_LEG_EDGE (coupon.constants.ts)
// for the reliability-by-edge table and for why this replaces correcting the
// probability. Uses the raw implied probability `1/odds`, not the
// overround-free `pMarketFair`, because that is what the measurement used.
//
// Distinct from clearsValueEdgeFloor, which is a MINIMUM edge for VALUE legs
// only: that one demands the model disagree with the market by at least
// VALUE_MIN_EDGE=0.10, this one rejects it for disagreeing by more. The two
// bracket a band — and the fact that they meet at the same 0.10 is exactly
// the finding: the region VALUE selects for is the region the model gets
// wrong (ratio 0.694 above 0.10, 0.954 below).
// Plancher de cote — voir MIN_LEG_ODDS. Contrainte produit (un coupon bâti sur
// des jambes à 1.04 n'en est pas un), sans coût mesuré en ROI.
export function clearsMinLegOdds(
  leg: { oddsSnapshot: number | null },
  band: { minLegOdds: number; maxLegOdds: number } = {
    minLegOdds: MIN_LEG_ODDS,
    maxLegOdds: Number.POSITIVE_INFINITY,
  },
): boolean {
  if (leg.oddsSnapshot === null) return false;
  return (
    leg.oddsSnapshot >= band.minLegOdds && leg.oddsSnapshot < band.maxLegOdds
  );
}

export function clearsMaxLegEdge(leg: {
  calibratedProbability: number | null;
  probability: number;
  calibratedHitRate: number;
  oddsSnapshot: number | null;
  referenceOdds?: number | null;
}): boolean {
  // Mesuré sur la cote de RÉFÉRENCE (maison la mieux classée), jamais sur le
  // prix de mise. Depuis qu'on mise au meilleur prix toutes maisons
  // confondues (findBestPricesBatch), utiliser `oddsSnapshot` ferait monter
  // tous les edges d'environ 2% et relâcherait ce plafond sans décision — on
  // relâcherait un garde-fou en croyant améliorer un prix.
  const reference = leg.referenceOdds ?? leg.oddsSnapshot;
  if (reference === null || reference <= 1) return false;
  return legProbability(leg) - 1 / reference <= MAX_LEG_EDGE;
}

// Shared anti-correlation bookkeeping — used identically by composeExhaustive
// (DFS) and composeGreedy (longshot) so the two strategies can never drift
// apart on what counts as "too correlated" (1/fixture, 1/canal+market,
// 2/competition, and an optional per-day cap for multi-day pools).
type AntiCorrelationState = {
  canalMarketCounts: Map<string, number>;
  compCounts: Map<string, number>;
  dayCounts: Map<string, number>;
};

function createAntiCorrelationState(legs: ScoredPick[]): AntiCorrelationState {
  const state: AntiCorrelationState = {
    canalMarketCounts: new Map(),
    compCounts: new Map(),
    dayCounts: new Map(),
  };
  for (const leg of legs) recordAntiCorrelation(state, leg);
  return state;
}

function recordAntiCorrelation(
  state: AntiCorrelationState,
  leg: ScoredPick,
): void {
  const cmKey = `${leg.canal}:${leg.market}`;
  state.canalMarketCounts.set(
    cmKey,
    (state.canalMarketCounts.get(cmKey) ?? 0) + 1,
  );
  state.compCounts.set(
    leg.competition,
    (state.compCounts.get(leg.competition) ?? 0) + 1,
  );
  state.dayCounts.set(
    leg.dayBucket,
    (state.dayCounts.get(leg.dayBucket) ?? 0) + 1,
  );
}

function violatesAntiCorrelation(
  current: ScoredPick[],
  next: ScoredPick,
  ctx: { state: AntiCorrelationState; bounds: CouponBounds },
): boolean {
  const { state } = ctx;
  if (current.some((p) => p.fixtureId === next.fixtureId)) return true;

  const cmKey = `${next.canal}:${next.market}`;
  if ((state.canalMarketCounts.get(cmKey) ?? 0) >= 1) return true;

  if ((state.compCounts.get(next.competition) ?? 0) >= 2) return true;

  return false;
}

@Injectable()
export class CouponComposerService {
  /**
   * Calibre chaque jambe : sa probabilité brute passe par la courbe de
   * fiabilité de son canal, et c'est tout.
   *
   * Ce qui a disparu le 2026-08-22 : le calcul de `signalScore` (50% taux
   * canal + 30% facteur jour-de-semaine + 20% taux ligue, tous glissants sur
   * 38 jours). Il a été mesuré ANTI-PRÉDICTIF — à probabilité calibrée
   * constante, une jambe à signalScore haut gagne MOINS souvent qu'une jambe
   * identique à signalScore bas, sur les quatre bandes de probabilité
   * comparables :
   *
   *   proba ~0.49 : bas 0.513 (n=236) vs haut 0.455 (n=202)    -5.8 pts
   *   proba ~0.58 : bas 0.669 (n=583) vs haut 0.604 (n=644)    -6.5 pts
   *   proba ~0.71 : bas 0.789 (n=190) vs haut 0.763 (n=194)    -2.6 pts
   *   proba ~0.80 : bas 0.919 (n=111) vs haut 0.813 (n=150)   -10.6 pts
   *   poolé       : 0.681 (n=1120) vs 0.631 (n=1190), -5.0 pts ± 2.0, t ~ 2.5
   *
   * Cause : ses trois composantes sont des taux de réussite passés par
   * (canal), (canal×jour), (canal×ligue) — exactement le découpage où la
   * décomposition de variance montre 88% de bruit. Sélectionner sur un taux
   * passé bruité revient à sélectionner la régression vers la moyenne.
   *
   * La colonne `signalScore` existe encore en base (NOT NULL) et s'affiche
   * côté produit : elle porte désormais la probabilité calibrée de la jambe,
   * qui est ce qu'un lecteur veut réellement y lire.
   */
  scorePicks(picks: ScoredPick[], calibration: LegCalibration): ScoredPick[] {
    return picks.map((pick) => {
      const calibratedProbability = calibrateLegProbability(
        { probability: pick.probability, canal: pick.canal },
        calibration,
      );
      const reliability =
        calibration.channelReliability[pick.canal] ??
        calibration.pooledReliability;

      // EV de jambe sur la cote RÉELLE uniquement (jamais de cote inventée) —
      // une jambe sans cote ne porte pas d'EV et sera exclue des coupons.
      const legEV =
        pick.oddsSnapshot !== null
          ? calculateEV(calibratedProbability, pick.oddsSnapshot).toNumber()
          : null;

      // Edge marché = proba calibrée − proba « fair » (overround retiré).
      const edge =
        pick.pMarketFair !== null
          ? calibratedProbability - pick.pMarketFair
          : null;

      const featureSnapshot = {
        ...pick.featureSnapshot,
        canal: pick.canal,
        league: pick.competition,
        calibratedProbability,
        channelReliabilityA: reliability.a,
        channelReliabilityB: reliability.b,
        channelReliabilityN: reliability.n,
        legEV,
        pMarketFair: pick.pMarketFair,
        bookmakerMargin: pick.bookmakerMargin,
        edge,
      };

      return {
        ...pick,
        calibratedHitRate: calibratedProbability,
        calibratedProbability,
        legEV,
        edge,
        signalScore: calibratedProbability,
        featureSnapshot,
      };
    });
  }

  compose(
    scoredPicks: ScoredPick[],
    opts: {
      bounds?: CouponBounds;
      targetCombinedOdds?: number;
      /**
       * Bande de cote des jambes admises. Ce qui différencie les classes —
       * elles sont disjointes, donc un même pick n'apparaît jamais dans deux
       * classes. Par défaut : le plancher global, sans plafond.
       */
      legOddsBand?: { minLegOdds: number; maxLegOdds: number };
      /** Plafond de jambes propre à la classe (défaut `bounds.maxLegs`). */
      maxLegs?: number;
    } = {},
  ): ComposedCoupon[] {
    const bounds = { ...(opts.bounds ?? COUPON_BOUNDS) };
    if (opts.maxLegs !== undefined) bounds.maxLegs = opts.maxLegs;
    // Règle d'ARRÊT : on cesse d'ajouter des jambes dès que la cible est
    // atteinte, ET le coupon n'est publié que s'il l'atteint. `undefined` =
    // pas de cible : on remplit jusqu'à `maxLegs` et on publie (comportement
    // historique, conservé pour les tests unitaires et les appels sans classe).
    const target = opts.targetCombinedOdds;
    // EVCore est value-driven : un coupon ne se construit que sur des jambes à
    // cote RÉELLE (B2 — plus de FALLBACK_ODDS). Une jambe sans cote n'a pas d'EV.
    const pricedPicks = scoredPicks
      .filter((p) => p.oddsSnapshot !== null)
      .filter((p) => clearsValueEdgeFloor(p))
      .filter((p) => clearsMaxLegEdge(p))
      .filter((p) => clearsMinLegOdds(p, opts.legOddsBand));

    const distinctFixtures = new Set(pricedPicks.map((p) => p.fixtureId));
    if (distinctFixtures.size < MIN_DISTINCT_FIXTURES) return [];

    const pool = buildCandidatePool(pricedPicks, MAX_POOL_SIZE);

    // Construction gloutonne par probabilité décroissante — l'algorithme
    // exactement validé hors échantillon (train 2023-04→2026-02, test
    // 2026-02→2026-08) : ROI −6.57% ± 11.1, contre −25.94% ± 15.0 pour la
    // recherche exhaustive classée par EV qui tournait en production.
    //
    // Ce qui a été retiré et pourquoi :
    //
    //   - `composeExhaustive` (DFS sur toutes les combinaisons) + tri par EV.
    //     Le tri par EV perd contre le tri par probabilité dans 13 des 16
    //     configurations comparées deux à deux (+6.7 points de moyenne), et
    //     l'énumération elle-même EST le winner's curse : retenir le maximum
    //     de centaines de candidats gonfle la métrique retenue même sans edge.
    //   - `composeGreedy` (variantes longshot) : plus de profil LONGSHOT, donc
    //     plus de coupon au-delà de maxLegs, donc chemin mort.
    //   - Classer par probabilité jointe une énumération complète serait
    //     dégénéré : un coupon à 2 jambes bat toujours un coupon à 5 sur le
    //     produit. C'est le nombre de jambes qui est borné, pas choisi par un
    //     critère.
    //
    // Chaque coupon consomme ses matchs : les suivants se construisent sur ce
    // qui reste, ce qui garantit des coupons totalement disjoints (remplace
    // sharesAnyLeg/selectDiverseCoupons, plus stricte puisque la disjonction
    // porte sur le match, pas sur le couple marché/pick).
    const usedFixtures = new Set<string>();
    const coupons: ComposedCoupon[] = [];

    for (let rank = 1; rank <= COUPON_PARAMS.maxCoupons; rank += 1) {
      const built = this.buildOne({ pool, bounds, target, usedFixtures });
      if (!built) break;

      for (const leg of built.legs) usedFixtures.add(leg.fixtureId);
      coupons.push({
        ...this.buildCoupon(built.legs, this.computeCombinedOdds(built.legs)),
        rank,
      });
    }

    return coupons;
  }

  /**
   * Un coupon glouton qui ATTEINT la cible de cote, ou rien.
   *
   * Le glouton part des plus fortes probabilités, donc des cotes les plus
   * courtes : ses premières jambes peuvent très bien multiplier sous la cible
   * sans qu'aucune jambe restante ne puisse rattraper. Une version antérieure
   * publiait alors le coupon tel quel — mesuré le 2026-08-22 : 60% des
   * coupons de la classe à cote courte sortaient sous 2.0, jusqu'à 1.44.
   *
   * On balaie donc les points de départ dans le vivier (déjà trié par
   * probabilité décroissante) et on retient la PREMIÈRE construction qui
   * franchit la cible — donc celle de plus forte probabilité parmi les
   * valides. Si aucune ne la franchit, on ne publie rien pour ce rang : mieux
   * vaut deux coupons honnêtes que trois dont un hors cible.
   *
   * Balayage linéaire sur la taille du vivier, pas combinatoire : on ne
   * réintroduit pas la recherche exhaustive retirée le 2026-08-22, qui
   * choisissait le maximum de centaines de candidats et créait le winner's
   * curse qu'on passe la journée à corriger.
   */
  private buildOne(ctx: {
    pool: ScoredPick[];
    bounds: CouponBounds;
    target: number | undefined;
    usedFixtures: ReadonlySet<string>;
  }): { legs: ScoredPick[] } | null {
    const { pool, bounds, target, usedFixtures } = ctx;

    for (let offset = 0; offset < pool.length; offset += 1) {
      const legs: ScoredPick[] = [];
      const state = createAntiCorrelationState(legs);
      let combinedOdds = 1;

      for (let i = offset; i < pool.length; i += 1) {
        const candidate = pool[i];
        if (legs.length >= bounds.maxLegs) break;
        if (usedFixtures.has(candidate.fixtureId)) continue;
        if (violatesAntiCorrelation(legs, candidate, { state, bounds })) {
          continue;
        }
        const nextOdds = combinedOdds * (candidate.oddsSnapshot as number);
        if (nextOdds > bounds.maxCombinedOdds) continue;

        legs.push(candidate);
        recordAntiCorrelation(state, candidate);
        combinedOdds = nextOdds;
        if (
          target !== undefined &&
          combinedOdds >= target &&
          legs.length >= bounds.minLegs
        ) {
          break;
        }
      }

      if (legs.length < bounds.minLegs) continue;
      if (new Set(legs.map((l) => l.fixtureId)).size < MIN_DISTINCT_FIXTURES) {
        continue;
      }
      if (target !== undefined && combinedOdds < target) continue;
      if (combinedOdds < bounds.minCombinedOdds) continue;

      return { legs };
    }

    return null;
  }

  private computeCombinedOdds(legs: ScoredPick[]): number {
    // Invariant compose() : seules des jambes à cote réelle arrivent ici.
    for (const leg of legs) {
      if (leg.oddsSnapshot === null) {
        throw new Error('compose: leg without real odds reached combinedOdds');
      }
    }
    return productDecimal(
      legs.map((leg) => leg.oddsSnapshot as number),
    ).toNumber();
  }

  private buildCoupon(
    legs: ScoredPick[],
    combinedOdds: number,
  ): ComposedCoupon {
    const rawJointProbability = legs.reduce(
      (acc, leg) => acc * legProbability(leg),
      1,
    );
    // Aucune correction au niveau coupon depuis le 2026-08-22 : les trois
    // essayées (par marché, par canal, pénalité uniforme) ont toutes été
    // absorbées par la sélection et ont dégradé le résultat — voir MAX_LEG_EDGE
    // (coupon.constants.ts) pour les mesures et pour le levier qui marche.
    // Les deux champs restent distincts pour que `reasoning` continue de
    // tracer la valeur brute même si une correction revient un jour.
    const jointProbability = rawJointProbability;
    // couponEV = P_coupon × Odd_coupon − 1 (source unique calculateEV).
    const couponEV = calculateEV(jointProbability, combinedOdds).toNumber();
    const signalScore =
      legs.reduce((acc, leg) => acc + leg.signalScore, 0) / legs.length;

    const reasoning: Record<string, unknown> = {
      legs: legs.map((l) => ({
        fixture: `${l.homeTeam} vs ${l.awayTeam}`,
        canal: l.canal,
        pick: `${l.market}/${l.pick}`,
        signalScore: l.signalScore,
        legEV: l.legEV,
        edge: l.edge,
        pMarketFair: l.pMarketFair,
        calibratedCanalHitRate:
          (l.featureSnapshot['calibratedCanalHitRate'] as number | undefined) ??
          null,
      })),
      combinedOdds,
      rawJointProbability,
      jointProbability,
      couponEV,
      signalScore,
    };

    return {
      rank: 0,
      legs,
      combinedOdds,
      rawJointProbability,
      jointProbability,
      couponEV,
      signalScore,
      reasoning,
    };
  }
}

// Classement value-driven (DESIGN.md §5) : EV de coupon d'abord, proba jointe
// en tie-break, puis le coupon le plus court à EV égale.
//
// Un tri signal-first (compareCouponsBySignalThenEV, canal×jour×ligue avant
// couponEV) a été essayé le 2026-08-20 : signalScore est bien plus prédictif
// que couponEV/jointProbability sur toute sa plage, mais reclasser sur ce
// critère n'a PAS amélioré le ROI mesuré une fois réellement backtesté (après
// correction d'un bug de non-régénération, voir deleteExpiredInRange,
// coupon.repository.ts) — combiné aux autres changements du jour, le ROI est
// tombé à -13.49% (n=106) contre +4.77% (n=478) sans lui. Revenu à l'EV-first
// historique en attendant une piste qui améliore vraiment le ROI mesuré, pas
// seulement la calibration d'un signal pris isolément.
export function compareCouponsByEV(
  a: ComposedCoupon,
  b: ComposedCoupon,
): number {
  if (b.couponEV !== a.couponEV) return b.couponEV - a.couponEV;
  if (b.jointProbability !== a.jointProbability) {
    return b.jointProbability - a.jointProbability;
  }
  return a.legs.length - b.legs.length;
}
