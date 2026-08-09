/**
 * Hyperparamètres du coupon.
 *
 * Source (réécrite 2026-08-09 — le fichier `backtest-selected-params.json`
 * cité ici auparavant n'existe pas dans ce repo, gap documenté dans
 * docs/formation-content-maintenance.md §5) :
 * packages/db/scripts/backtest-coupon-params-validation.ts, rejouable via
 * `pnpm --filter @evcore/db db:backtest:coupon-params-validation`. Valide sur
 * les 403 vrais `CouponProposal` réglés depuis 2023-04-15 (pas une
 * simulation), split train/valid 60/40 par jour :
 *   - global (tous les paramètres actuels)   : train ROI +28.3% | valid ROI +19.8%
 *   - `minCouponEV` resserré à 0.15           : train ROI +29.2% | valid ROI +23.2%
 *     (0.20+ dégrade train, 0.30 inverse le signe — non retenu)
 *   - `maxCombinedOdds` resserré (≤4/≤5)      : train s'améliore (+36%/+39%)
 *     mais valid s'effondre (-18.5%/-1.6%) — signature de surapprentissage,
 *     PAS resserré, gardé à 6.0.
 *
 * `k`/`capMin`/`capMax`/`decayHalfLifeDays`/`windowDays`/`nLeagueMin` ne sont
 * PAS couverts par ce script (ils alimentent la calibration canal/jour/ligue
 * dans SignalWindowService.computeSignalWindow, pas testée ici) — hérités
 * sans nouvelle validation, à couvrir par un futur backtest dédié.
 *
 * NE PAS modifier manuellement — relancer le backtest ci-dessus pour toute
 * révision.
 */

import type { StrategyChannel } from '@evcore/db';

export type CouponChannel = Extract<
  StrategyChannel,
  'VALUE' | 'SAFE' | 'BTTS' | 'DRAW' | 'DOMINANT' | 'TEAM_TOTAL'
>;

// BTTS staking (B7-style promotion) — the aggregate ROI hides a real
// per-league split. Re-validated 2026-08-09 with a temporal train/valid split
// (db:backtest:channel-league-whitelist, 60/40 by day, confirmed only if both
// halves clear n>=20 AND stay positive): SA dropped out (train -2.84%, valid
// +20.47% — sign flips across the split, not reliably positive) versus the
// 2026-07-28 aggregate-only backtest that had included it. PL/BL1 remain
// confirmed in both periods.
export const BTTS_STAKED_LEAGUES = ['PL', 'BL1'] as const;

// DRAW staking, per-league (added 2026-08-09) — DRAW previously staked
// globally off a single low CANAL_BASE_WEIGHT.DRAW=0.2 prior, which hid a
// per-league ROI spread from +41% to -45%. db:backtest:channel-league-
// whitelist (60/40 split by day, confirmed only if both halves clear n>=20
// AND stay positive) confirms exactly these 3: I2 +6.7%, POR +10.5%,
// BL1 +15.8%, train and valid both positive. Several other leagues look
// promising in the aggregate (FRI, KOR1/2, CSL, BRA2, WC, CHN2) but have no
// train-period sample yet (too little settled history) — revisit once they
// do, don't add them off the aggregate alone.
export const DRAW_STAKED_LEAGUES = ['I2', 'POR', 'BL1'] as const;

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
  // Aligned with the backtested topN=3 ranking (db:backtest:invest-ranking,
  // 2026-07-28) — edge-ranked, not probability-ranked (see MODE_RANKING.teamTotal).
  TEAM_TOTAL: 3,
} as const;

export const CANAL_BASE_WEIGHT: Record<CouponChannel, number> = {
  SAFE: 0.74,
  DOMINANT: 0.66,
  BTTS: 0.62,
  VALUE: 0.36,
  DRAW: 0.2,
  // Conservative launch weight (2026-07-28) — below DRAW's, since TEAM_TOTAL's
  // +3.40% ROI (n=845) rests on only 9 days of history. Revisit once more days
  // accumulate.
  TEAM_TOTAL: 0.15,
} as const;

export const COUPON_PARAMS = {
  k: 20,
  capMin: 0.05,
  capMax: 0.8,
  minCalibratedJointProbability: 0.25,
  // Seuil d'EV de coupon (Étape 1 — EV au cœur du coupon). Un coupon n'est viable
  // que si `couponEV = P_coupon × Odd_coupon − 1 ≥ minCouponEV`. Resserré de
  // 0.05 à 0.15 le 2026-08-09 (db:backtest:coupon-params-validation, sur les
  // 403 CouponProposal réels réglés) : train ROI +28.3%→+29.2%, valid ROI
  // +19.8%→+23.2%, les deux améliorés — 0.20 dégrade train, 0.30 inverse le
  // signe, non retenus.
  minCouponEV: 0.15,
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
    TEAM_TOTAL: 20,
  } as Record<CouponChannel, number>,
} as const;

// ─────────────────────────────────────────────
// Profils de risque (Étape 4 — corrige B8/B9)
// ─────────────────────────────────────────────

export type CouponProfileName =
  | 'SAFE'
  | 'BALANCED'
  | 'AGGRESSIVE'
  | 'LONGSHOT_WEEKEND'
  | 'LONGSHOT_MIDWEEK';

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
  /**
   * Plafond de jambes par jour calendaire (`ScoredPick.dayBucket`) — évite
   * qu'un coupon multi-jours (fenêtre weekend/midweek) concentre tout son
   * risque sur un seul jour. `undefined` = pas de plafond (profils mono-jour
   * actuels, comportement inchangé).
   */
  maxLegsPerDay?: number;
};

/**
 * Au-delà de ce nombre de jambes, `compose()` bascule de la recherche
 * exhaustive (`composeExhaustive`, DFS sur le pool trié) au glouton borné
 * (`composeGreedy`) — C(25,5)=2300 combinaisons reste traitable, C(25,8)≈1M
 * ne l'est plus. Les profils actuels (SAFE/BALANCED/AGGRESSIVE, ≤5 legs)
 * restent tous sur l'exhaustif ; seuls les profils LONGSHOT (8-12 legs)
 * basculent sur le glouton.
 */
export const EXHAUSTIVE_LEG_THRESHOLD = 5;

/**
 * Nombre de points de départ distincts essayés par `composeGreedy` (chacun
 * force la jambe de rang N du pool trié en premier, puis complète glouton) —
 * donne plusieurs coupons longshot candidats au lieu d'un seul, sans repasser
 * à une recherche exhaustive intraitable sur autant de jambes.
 */
export const GREEDY_START_VARIANTS = 3;

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
  // Longshot multi-jours (plan coupon 2026-08-09) — cote combinée cible
  // 50-70 sur la fenêtre weekend (ven→dim) / midweek européen (mar→jeu),
  // routé vers CouponComposerService.composeGreedy (> EXHAUSTIVE_LEG_THRESHOLD
  // legs). maxLegsPerDay évite qu'un coupon 3 jours se concentre sur un seul
  // jour. Valeurs indicatives — comme SAFE/BALANCED/AGGRESSIVE, à confirmer
  // par un backtest dédié (db:backtest:coupon-longshot, pas encore écrit)
  // avant toute activation en génération live.
  LONGSHOT_WEEKEND: {
    minLegs: 6,
    maxLegs: 12,
    minCombinedOdds: 50.0,
    maxCombinedOdds: 70.0,
    minJointProbability: 0.01,
    minCouponEV: 0.2,
    maxLegsPerDay: 5,
  },
  LONGSHOT_MIDWEEK: {
    minLegs: 6,
    maxLegs: 12,
    minCombinedOdds: 50.0,
    maxCombinedOdds: 70.0,
    minJointProbability: 0.01,
    minCouponEV: 0.2,
    maxLegsPerDay: 5,
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
