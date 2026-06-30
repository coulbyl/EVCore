/**
 * Hyperparamètres du coupon — outputs du backtest (2026-05-19).
 *
 * Source : apps/backend/reports/backtest-selected-params.json
 * Train ROI : +100.3% | Test ROI : +61.8% | Test hit rate : 51.5% | verdict : PASS
 *
 * NE PAS modifier manuellement — relancer le backtest et mettre à jour depuis
 * backtest-selected-params.json.
 */

import type { StrategyChannel } from '@evcore/db';

export type CouponChannel = Extract<
  StrategyChannel,
  'VALUE' | 'SAFE' | 'BTTS' | 'DRAW' | 'DOMINANT'
>;

export type VirtualCouponChannel =
  | 'SAFE_HT_OVER05'
  | 'SAFE_UNDER45'
  | 'SAFE_OVER15'
  | 'SAFE_UNDER35'
  | 'BTTS_YES';

export type CouponOutputChannel = CouponChannel | VirtualCouponChannel;

// Plafond du nombre de sélections RETENUES par canal dans le POOL (par jour),
// PAS le nombre de jambes d'un coupon — concept distinct des bornes de profil
// (`CouponProfileBounds.maxLegs`). Levée d'ambiguïté B8 : un coupon est borné par
// son profil ; ceci borne combien de candidats d'un canal entrent dans le pool.
export const MAX_COUPON_SELECTIONS: Record<CouponChannel, number> = {
  SAFE: 5,
  BTTS: 5,
  DOMINANT: 5,
  DRAW: 2,
  VALUE: 2,
} as const;

export const CANAL_BASE_WEIGHT: Record<CouponChannel, number> = {
  SAFE: 0.74,
  DOMINANT: 0.66,
  BTTS: 0.62,
  VALUE: 0.36,
  DRAW: 0.2,
} as const;

export const COUPON_PARAMS = {
  k: 20,
  capMin: 0.05,
  capMax: 0.8,
  minCalibratedJointProbability: 0.25,
  // Seuil d'EV de coupon (Étape 1 — EV au cœur du coupon). Un coupon n'est viable
  // que si `couponEV = P_coupon × Odd_coupon − 1 ≥ minCouponEV`. Valeur proposée
  // 0.05 en attendant le backtest dédié (Étape 7 / profils de risque Étape 4) —
  // à promouvoir comme sortie de backtest, pas réglage manuel durable.
  minCouponEV: 0.05,
  maxLegs: 3,
  maxCoupons: 3,
  maxCombinedOdds: 6.0,
  recencyWeighting: 'exponential_decay_14d' as const,
  decayHalfLifeDays: 14,
  nLeagueMin: 15,
  windowDays: 38,
  includeConfInCoupons: true,
  couponMinSample: {
    SAFE: 10,
    BTTS: 10,
    VALUE: 5,
    DOMINANT: 20,
    DRAW: 20,
  } as Record<CouponChannel, number>,
} as const;

// ─────────────────────────────────────────────
// Profils de risque (Étape 4 — corrige B8/B9)
// ─────────────────────────────────────────────

export type CouponProfileName = 'SAFE' | 'BALANCED' | 'AGGRESSIVE';

/**
 * Bornes d'un profil de risque — source unique des contraintes appliquées par
 * `CouponComposerService.compose`. Un coupon n'est viable que s'il respecte TOUTES
 * ces bornes : nombre de jambes, cote combinée, proba jointe et EV de coupon.
 */
export type CouponProfileBounds = {
  minLegs: number;
  maxLegs: number;
  minCombinedOdds: number;
  maxCombinedOdds: number;
  minJointProbability: number;
  minCouponEV: number;
};

/**
 * Profils indicatifs (DESIGN.md Étape 4) — **valeurs à confirmer par backtest,
 * pas encore activées en génération** (cf. gate Étape 7). La génération live passe
 * par `DEFAULT_COUPON_PROFILE` (bornes backtestées). Ces presets sont disponibles
 * pour expérimentation / backtest avant promotion.
 */
export const COUPON_PROFILES: Record<CouponProfileName, CouponProfileBounds> = {
  SAFE: {
    minLegs: 2,
    maxLegs: 3,
    minCombinedOdds: 1.6,
    maxCombinedOdds: 2.5,
    minJointProbability: 0.45,
    minCouponEV: 0.03,
  },
  BALANCED: {
    minLegs: 2,
    maxLegs: 4,
    minCombinedOdds: 2.2,
    maxCombinedOdds: 5.0,
    minJointProbability: 0.25,
    minCouponEV: 0.08,
  },
  AGGRESSIVE: {
    minLegs: 3,
    maxLegs: 5,
    minCombinedOdds: 4.0,
    maxCombinedOdds: 12.0,
    minJointProbability: 0.1,
    minCouponEV: 0.15,
  },
} as const;

/**
 * Profil appliqué en génération live — dérivé des paramètres **backtestés**
 * (`COUPON_PARAMS`, backtest 2026-05-19), donc aucune régression vs l'existant.
 * Correspond grosso modo à un BALANCED élargi ; les profils nommés ci-dessus ne le
 * remplacent qu'après gate de backtest vert (Étape 7).
 */
export const DEFAULT_COUPON_PROFILE: CouponProfileBounds = {
  minLegs: 2,
  maxLegs: COUPON_PARAMS.maxLegs,
  minCombinedOdds: 1.0,
  maxCombinedOdds: COUPON_PARAMS.maxCombinedOdds,
  minJointProbability: COUPON_PARAMS.minCalibratedJointProbability,
  minCouponEV: COUPON_PARAMS.minCouponEV,
};

export function resolveCouponProfile(
  name?: CouponProfileName,
): CouponProfileBounds {
  return name ? COUPON_PROFILES[name] : DEFAULT_COUPON_PROFILE;
}

export type VirtualCouponRule = {
  canal: VirtualCouponChannel;
  label: string;
  market: string;
  pick: string;
  prior: number;
  minProbability: number;
  maxProbability: number;
  minOdds?: number;
  maxOdds?: number;
  minEvMargin?: number;
  minLambda?: number;
  allowMissingOdds?: boolean;
  excludedLeagues?: readonly string[];
  excludedProbabilityRanges?: readonly (readonly [number, number])[];
  leagueBoosts?: Partial<Record<string, number>>;
  channelCapTop5?: number;
  channelCapTop10?: number;
};

export const VIRTUAL_COUPON_RULES: readonly VirtualCouponRule[] = [
  {
    canal: 'SAFE_HT_OVER05',
    label: 'Over 0.5 HT',
    market: 'OVER_UNDER_HT',
    pick: 'OVER_0_5',
    prior: 0.805,
    minProbability: 0.75,
    maxProbability: 0.85,
    maxOdds: 1.5,
    excludedLeagues: ['EL1'],
  },
  {
    canal: 'SAFE_UNDER45',
    label: 'Under 4.5',
    market: 'OVER_UNDER',
    pick: 'UNDER_4_5',
    prior: 0.818,
    minProbability: 0.75,
    maxProbability: 0.95,
    maxOdds: 1.5,
    excludedLeagues: ['NOR2', 'TUR1'],
  },
  {
    canal: 'SAFE_OVER15',
    label: 'Over 1.5',
    market: 'OVER_UNDER',
    pick: 'OVER_1_5',
    prior: 0.738,
    minProbability: 0.75,
    maxProbability: 0.85,
    maxOdds: 1.5,
    minEvMargin: 0.03,
    excludedLeagues: ['EL1'],
  },
  {
    canal: 'SAFE_UNDER35',
    label: 'Under 3.5',
    market: 'OVER_UNDER',
    pick: 'UNDER_3_5',
    prior: 0.692,
    minProbability: 0.65,
    maxProbability: 0.85,
    maxOdds: 1.8,
    excludedLeagues: ['MX1'],
    excludedProbabilityRanges: [[0.75, 0.8]],
    leagueBoosts: { CH: 0.08 },
  },
  {
    canal: 'BTTS_YES',
    label: 'BTTS Yes',
    market: 'BTTS',
    pick: 'YES',
    prior: 0.655,
    minProbability: 0.6,
    maxProbability: 0.75,
    allowMissingOdds: true,
    minLambda: 3.1,
    excludedLeagues: ['ERD', 'EL1', 'EL2'],
    excludedProbabilityRanges: [[0.65, 0.7]],
    leagueBoosts: { SP2: 0.06 },
    channelCapTop5: 1,
  },
] as const;

export const MAX_VIRTUAL_COUPON_SELECTIONS: Record<
  VirtualCouponChannel,
  number
> = {
  SAFE_HT_OVER05: 5,
  SAFE_UNDER45: 5,
  SAFE_OVER15: 5,
  SAFE_UNDER35: 5,
  BTTS_YES: 5,
} as const;

export const VIRTUAL_COUPON_TOP_LIMITS = {
  top5: 5,
  top10: 10,
  channelCapTop5: 2,
  channelCapTop10: 3,
} as const;
