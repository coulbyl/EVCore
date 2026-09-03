import Decimal from "decimal.js";
import { VALUE_MIN_EDGE } from "../selection/constants";
import {
  applyReliability,
  type ChannelReliability,
  type ChannelReliabilityMap,
} from "./channel-reliability";

/** Minimal shape a coupon leg must have for the guardrail predicates below —
 * a structural subset of `ScoredPick`
 * (apps/backend/src/modules/coupon/coupon-pool.service.ts), which this
 * package never imports (no package→app dependency). Each function below
 * only requires the fields it actually reads, via `Pick<CouponLeg, ...>`. */
export type CouponLeg = {
  fixtureId: string;
  canal: string;
  market: string;
  pick: string;
  competition: string;
  dayBucket: string;
  probability: number;
  calibratedHitRate: number;
  calibratedProbability: number | null;
  oddsSnapshot: number | null;
  referenceOdds?: number | null;
  featureSnapshot: Record<string, unknown>;
  offensiveBalance: "BALANCED" | "ASYMMETRIC" | "STRONGLY_ASYMMETRIC" | null;
  shadowConflict: boolean | null;
  priorAnalysisCount: number;
};

// jointProbability was previously the product of canal-level calibrated hit
// rates only — every coupon with the same canal mix stored the identical value
// (audit 2026-06-11: six pending coupons all at 0.4743 = SAFE rate × BTTS rate),
// making the viability filter and the jointProbability sort degenerate among
// same-canal combos. Blending each pick's model probability with its canal
// calibrated rate keeps the calibration tempering (raw model probabilities are
// over-confident) while restoring pick-specific joint probabilities.
export const LEG_PROBABILITY_MODEL_WEIGHT = 0.5;

export function calibratedLegProbability(
  leg: Pick<CouponLeg, "probability" | "calibratedHitRate">,
): number {
  return (
    leg.probability * LEG_PROBABILITY_MODEL_WEIGHT +
    leg.calibratedHitRate * (1 - LEG_PROBABILITY_MODEL_WEIGHT)
  );
}

// Bounds the calibrated probability applyReliability can return — same
// values as COUPON_PARAMS.capMin/capMax
// (apps/backend/src/modules/coupon/coupon.constants.ts), moved alongside
// calibrateLegProbability (their only reader) 2026-09-03.
const CALIBRATED_PROBABILITY_CAP_MIN = 0.05;
const CALIBRATED_PROBABILITY_CAP_MAX = 0.8;

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
    CALIBRATED_PROBABILITY_CAP_MAX,
    Math.max(CALIBRATED_PROBABILITY_CAP_MIN, calibrated),
  );
}

// Single source of truth for a leg's probability inside a coupon: the calibrated
// value when scoring has run, otherwise the legacy blend (keeps compose()
// correct even when called without a prior scorePicks, e.g. in unit tests).
export function legProbability(
  leg: Pick<
    CouponLeg,
    "calibratedProbability" | "probability" | "calibratedHitRate"
  >,
): number {
  return leg.calibratedProbability ?? calibratedLegProbability(leg);
}

// Depth tie-break — NOT a probability/EV weight (db:backtest:coupon-quality-
// signals still shows train n=0 on these three signals as of 2026-08-15, so
// they can't be calibrated into signalScore yet). Used only to order
// otherwise-similar picks. Higher is better: offensiveBalance BALANCED >
// unknown (null) > ASYMMETRIC > STRONGLY_ASYMMETRIC; shadowConflict false (no
// conflict) > unknown (null) > true; more prior analyses of this exact
// (market, pick) preferred, capped so it can't dominate the other two
// components.
export function depthRank(
  pick: Pick<
    CouponLeg,
    "offensiveBalance" | "shadowConflict" | "priorAnalysisCount"
  >,
): number {
  const offensiveBalanceRank =
    pick.offensiveBalance === "BALANCED"
      ? 2
      : pick.offensiveBalance === null
        ? 1
        : pick.offensiveBalance === "ASYMMETRIC"
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

// League override table for VALUE's minimum edge — moved alongside
// clearsValueEdgeFloor (its only reader) 2026-09-03. Was
// apps/backend/src/modules/betting-engine/ev.constants.ts's
// getValueMinEdge/LEAGUE_VALUE_MIN_EDGE_MAP. FRI (friendlies) suspended
// 2026-07-01: no reliable xG, model 1X2 calibration FAILs (calErr 0.054),
// VALUE −24.5% n=17 on recent data at the time.
const VALUE_SUSPENDED = new Decimal("1");
const LEAGUE_VALUE_MIN_EDGE_MAP: Record<string, Decimal> = {
  FRI: VALUE_SUSPENDED,
};

function getValueMinEdge(competitionCode: string | null): Decimal | undefined {
  if (
    competitionCode !== null &&
    competitionCode in LEAGUE_VALUE_MIN_EDGE_MAP
  ) {
    return LEAGUE_VALUE_MIN_EDGE_MAP[competitionCode];
  }
  return undefined;
}

// VALUE-only edge floor, mirroring the standalone VALUE channel's own gate
// (probability − 1/odds ≥ getValueMinEdge(league) ?? VALUE_MIN_EDGE=0.10).
// ⚠️ Inatteignable en production depuis le 2026-09-03 : VALUE est déconnecté
// de la pipeline live (docs/vantage-centric-redesign-2026-09-01.md §5.1),
// donc plus jamais dans le pool. Gardé pour la valeur documentaire du
// constat : la région que VALUE sélectionne (forte divergence modèle↔marché)
// est précisément celle où le modèle réalise 0.694 de ce qu'il annonce,
// contre 0.954 en dessous — le seuil VALUE_MIN_EDGE=0.10 et le plafond
// MAX_LEG_EDGE=0.10 (ci-dessous) sont le résultat central de cette mesure,
// pas une coïncidence.
export function clearsValueEdgeFloor(
  leg: Pick<
    CouponLeg,
    "canal" | "calibratedProbability" | "oddsSnapshot" | "featureSnapshot"
  >,
  getMinEdge: (
    competitionCode: string | null,
  ) => Decimal | undefined = getValueMinEdge,
): boolean {
  if (leg.canal !== "VALUE") return true;
  if (leg.calibratedProbability === null || leg.oddsSnapshot === null) {
    return false;
  }
  const competitionCode =
    (leg.featureSnapshot["competitionCode"] as string | undefined) ?? null;
  const minEdge = getMinEdge(competitionCode) ?? VALUE_MIN_EDGE;
  const edge = new Decimal(leg.calibratedProbability).minus(
    new Decimal(1).div(leg.oddsSnapshot),
  );
  return edge.greaterThanOrEqualTo(minEdge);
}

// Plancher de cote — contrainte produit (un coupon bâti sur des jambes à
// 1.04 n'en est pas un), sans coût mesuré en ROI. Moved alongside
// clearsMinLegOdds (its only reader) 2026-09-03 — was
// coupon.constants.ts's MIN_LEG_ODDS.
const MIN_LEG_ODDS = 1.2;

export function clearsMinLegOdds(
  leg: Pick<CouponLeg, "oddsSnapshot">,
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

// Plafond de cote — TEAM_TOTAL uniquement. Contrairement à
// clearsValueEdgeFloor (canal entièrement retiré du pool), TEAM_TOTAL reste
// admis : bien calibré sous ce plafond, mal calibré au-dessus — une borne de
// cote, pas une exclusion de canal. Moved alongside clearsTeamTotalMaxOdds
// (its only reader) 2026-09-03 — was coupon.constants.ts's
// TEAM_TOTAL_MAX_ODDS.
const TEAM_TOTAL_MAX_ODDS = 2.3;

export function clearsTeamTotalMaxOdds(
  leg: Pick<CouponLeg, "canal" | "oddsSnapshot">,
): boolean {
  if (leg.canal !== "TEAM_TOTAL") return true;
  if (leg.oddsSnapshot === null) return false;
  return leg.oddsSnapshot < TEAM_TOTAL_MAX_ODDS;
}

// Rejects a leg whose model↔market divergence is beyond the range where the
// model has been measured reliable. Moved alongside clearsMaxLegEdge (its
// only reader) 2026-09-03 — was coupon.constants.ts's MAX_LEG_EDGE, complement
// of VALUE_MIN_EDGE=0.10 above (not a coincidence — see clearsValueEdgeFloor).
const MAX_LEG_EDGE = 0.1;

export function clearsMaxLegEdge(
  leg: Pick<
    CouponLeg,
    | "calibratedProbability"
    | "probability"
    | "calibratedHitRate"
    | "oddsSnapshot"
    | "referenceOdds"
  >,
): boolean {
  // Mesuré sur la cote de RÉFÉRENCE (maison la mieux classée), jamais sur le
  // prix de mise — voir clearsMaxLegEdge's original doc comment
  // (apps/backend/src/modules/coupon/coupon-composer.service.ts) for why.
  const reference = leg.referenceOdds ?? leg.oddsSnapshot;
  if (reference === null || reference <= 1) return false;
  return legProbability(leg) - 1 / reference <= MAX_LEG_EDGE;
}

// Shared anti-correlation bookkeeping — used identically by every coupon
// composer strategy so none can drift apart on what counts as "too
// correlated" (1/fixture, 1/canal+market, 2/competition).
export type AntiCorrelationState = {
  canalMarketCounts: Map<string, number>;
  compCounts: Map<string, number>;
  dayCounts: Map<string, number>;
};

export function createAntiCorrelationState(
  legs: readonly Pick<
    CouponLeg,
    "canal" | "market" | "competition" | "dayBucket"
  >[],
): AntiCorrelationState {
  const state: AntiCorrelationState = {
    canalMarketCounts: new Map(),
    compCounts: new Map(),
    dayCounts: new Map(),
  };
  for (const leg of legs) recordAntiCorrelation(state, leg);
  return state;
}

export function recordAntiCorrelation(
  state: AntiCorrelationState,
  leg: Pick<CouponLeg, "canal" | "market" | "competition" | "dayBucket">,
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

export function violatesAntiCorrelation(
  current: readonly Pick<CouponLeg, "fixtureId">[],
  next: Pick<CouponLeg, "fixtureId" | "canal" | "market" | "competition">,
  ctx: { state: AntiCorrelationState },
): boolean {
  const { state } = ctx;
  if (current.some((p) => p.fixtureId === next.fixtureId)) return true;

  const cmKey = `${next.canal}:${next.market}`;
  if ((state.canalMarketCounts.get(cmKey) ?? 0) >= 1) return true;

  if ((state.compCounts.get(next.competition) ?? 0) >= 2) return true;

  return false;
}

// Classement value-driven : EV de coupon d'abord, proba jointe en tie-break,
// puis le coupon le plus court à EV égale. A signal-first ordering (canal×
// jour×ligue before couponEV) was tried 2026-08-20 and reverted the same
// night — see ComposedCoupon's doc comment
// (apps/backend/src/modules/coupon/coupon-composer.service.ts) for the
// measured result.
export function compareCouponsByEV(
  a: { couponEV: number; jointProbability: number; legs: readonly unknown[] },
  b: { couponEV: number; jointProbability: number; legs: readonly unknown[] },
): number {
  if (b.couponEV !== a.couponEV) return b.couponEV - a.couponEV;
  if (b.jointProbability !== a.jointProbability) {
    return b.jointProbability - a.jointProbability;
  }
  return a.legs.length - b.legs.length;
}
