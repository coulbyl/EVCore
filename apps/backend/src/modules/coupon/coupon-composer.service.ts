import { Injectable } from '@nestjs/common';
import {
  calibrateLegProbability,
  clearsMaxLegEdge,
  clearsMinLegOdds,
  clearsTeamTotalMaxOdds,
  clearsValueEdgeFloor,
  createAntiCorrelationState,
  legProbability,
  recordAntiCorrelation,
  violatesAntiCorrelation,
} from '@evcore/analysis-core';
import { productDecimal } from '@utils/decimal.utils';
import { calculateEV } from '@modules/betting-engine/betting-engine.utils';
import {
  COUPON_PARAMS,
  COUPON_BOUNDS,
  type CouponBounds,
} from './coupon.constants';
import type { LegCalibration, ScoredPick } from './coupon-pool.service';

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
      .filter((p) => clearsTeamTotalMaxOdds(p))
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
        if (violatesAntiCorrelation(legs, candidate, { state })) {
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
        // Was reading `featureSnapshot['calibratedCanalHitRate']` — a key
        // from the sliding-window calibration system removed 2026-08-22
        // (see coupon-pool.service.ts's CouponPoolService doc comment)
        // that nothing has written since, so this was silently `null` on
        // every leg of every coupon for the last 6 days. The per-channel
        // calibration curve that replaced it already sits right on the leg
        // as `calibratedProbability` (scorePicks()) — no lookup needed.
        calibratedProbability: l.calibratedProbability,
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
