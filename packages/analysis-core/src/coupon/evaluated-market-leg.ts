import { AVOID_CONFIG } from "../strategies/avoid.config";
import {
  STRATEGY_CHANNEL,
  type StrategyChannel,
} from "../types/strategy-channel";

// AVOID enforcement at staking time: a pick whose model probability exceeds its
// implied probability (1/odds) by ≥ AVOID_CONFIG.maxEdge is an implausible
// model↔market divergence — validated -20% ROI on those picks over 3 seasons
// (see AVOID strategy). Drop it from the real, staking-eligible pool.
export function isExtremeDivergence(
  probability: number,
  odds: number | null,
): boolean {
  if (odds === null || odds <= 1) return false;
  return probability - 1 / odds >= AVOID_CONFIG.maxEdge;
}

// AVOID regime for a leg, from its two independent signals — validated on
// settled MODEL bets (2026-08-09 plan): neither signal alone is a reliable
// fade (extreme divergence alone: -16.7% ROI on the original pick but +19.3%
// on its opposite over n=32; calibration alert alone: -14.2%/-19.9% on
// either side, no edge, n=55) — but BOTH together flip back to the original
// pick being excellent (+51% ROI, n=32). A plain OR (today's binary AVOID)
// throws away that last case.
export type AvoidRegime = "CLEAN" | "FADE" | "DROP" | "KEEP";

export function classifyAvoidSignal(
  extremeDivergence: boolean,
  calibrationAlert: boolean,
): AvoidRegime {
  if (!extremeDivergence && !calibrationAlert) return "CLEAN";
  if (extremeDivergence && calibrationAlert) return "KEEP";
  return extremeDivergence ? "FADE" : "DROP";
}

function readSnapshotNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value.replace("%", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// Market évalué (`ModelRun.features.evaluatedPicks`, `status: 'viable'`) →
// canal coupon — trouvé 2026-08-16 en creusant le biais suspecté dans
// `CouponPoolService` (alors `SignalWindowService`) : `getPoolForRange` (le
// vrai pool de coupon) ne lit que les `Bet`/`channelDecision` déjà
// matérialisés, une seule jambe par canal par match — jamais les autres
// marchés évalués sur le même match. Exactement le trou documenté par
// `COUPON_ANALYSIS_TEMPLATE.md` (Étape 0) : "parcourir evaluatedPicks en
// entier, pas juste selectedPicks". Élargi le 2026-09-03
// (`includeEvRejected` on resolveEvaluatedMarketLeg below) pour aussi
// admettre un pick rejeté pour une raison EV/cote seule (pas de fiabilité) —
// même distinction que le template.
//
// Mapping délibérément simple — PAS une reproduction de la logique de
// sélection de chacun des canaux spécialisés (tous différents) contre le
// snapshot persisté (lossy — `number` simple, pas de `Decimal`, pas de
// contexte ligue par jambe) : `status: 'viable'` a déjà passé les gates du
// système (probabilité plancher, cote dans la fourchette, marché non
// suspendu, EV dans une bande acceptable, pas de pénalité longshot) — ce
// n'est pas un rejet de fiabilité de ne pas avoir gagné l'arbitrage de son
// canal contre les autres marchés du même match.
//
// - ONE_X_TWO → DOMINANT (son propre marché).
// - TEAM_TOTAL_HOME/AWAY → TEAM_TOTAL, BTTS → BTTS (marchés dédiés).
// - CORRECT_SCORE → exclu (absent de ce mapping) — signal immature (AUC=0.51,
//   quasi hasard ; voir TODO.md / mémoire project_correct_score_immature),
//   jamais staké nulle part.
// - Tout le reste (OVER_UNDER, OVER_UNDER_HT, DOUBLE_CHANCE,
//   HALF_TIME_FULL_TIME, FIRST_HALF_WINNER, DRAW_NO_BET, CLEAN_SHEET_*,
//   WIN_TO_NIL_*, TO_WIN_EITHER_HALF, RESULT_TOTAL_GOALS, RESULT_BTTS) →
//   son propre canal spécialisé, jamais VALUE (VALUE/SAFE sont déconnectés
//   de la pipeline live depuis 2026-09-03, voir docs/vantage-centric-
//   redesign-2026-09-01.md §5.1).
export const EVALUATED_MARKET_CANAL: Record<string, StrategyChannel> = {
  ONE_X_TWO: STRATEGY_CHANNEL.DOMINANT,
  OVER_UNDER: STRATEGY_CHANNEL.GOALS,
  OVER_UNDER_HT: STRATEGY_CHANNEL.OVER_UNDER_HT,
  BTTS: STRATEGY_CHANNEL.BTTS,
  TEAM_TOTAL_HOME: STRATEGY_CHANNEL.TEAM_TOTAL,
  TEAM_TOTAL_AWAY: STRATEGY_CHANNEL.TEAM_TOTAL,
  DOUBLE_CHANCE: STRATEGY_CHANNEL.DOUBLE_CHANCE,
  DRAW_NO_BET: STRATEGY_CHANNEL.DRAW_NO_BET,
  HALF_TIME_FULL_TIME: STRATEGY_CHANNEL.HALF_TIME_FULL_TIME,
  FIRST_HALF_WINNER: STRATEGY_CHANNEL.FIRST_HALF,
  TO_WIN_EITHER_HALF: STRATEGY_CHANNEL.WIN_EITHER_HALF,
  CLEAN_SHEET_HOME: STRATEGY_CHANNEL.CLEAN_SHEET,
  CLEAN_SHEET_AWAY: STRATEGY_CHANNEL.CLEAN_SHEET,
  WIN_TO_NIL_HOME: STRATEGY_CHANNEL.WIN_TO_NIL,
  WIN_TO_NIL_AWAY: STRATEGY_CHANNEL.WIN_TO_NIL,
  RESULT_TOTAL_GOALS: STRATEGY_CHANNEL.RESULT_TOTAL_GOALS,
  RESULT_BTTS: STRATEGY_CHANNEL.RESULT_BTTS,
  // CORRECT_SCORE stays out: its scoreline signal is validated for
  // reasonDetails only, never for staking (TODO.md, 2026-08-15).
} as const;

// Rejection reasons that mean the pick genuinely fails on reliability grounds
// (model overconfidence, uncalibrated league, overdispersion risk, quality
// floor) — never a legitimate candidate, even for a hand-built combo. Every
// other rejectionReason (ev_above_hard_cap/ev_above_soft_cap/ev_below_threshold,
// odds_below_floor/odds_above_cap) is about the single-bet auto-stake
// threshold, which COUPON_ANALYSIS_TEMPLATE.md (Étape 0/5) is explicit is
// "hors sujet" for judging a leg's reliability inside a combo — see
// `getPickRejectionReason` (../selection/pick-validation.ts) for where each
// reason is actually raised.
export const RELIABILITY_REJECTION_REASONS: ReadonlySet<string> = new Set([
  "probability_too_low",
  "quality_score_below_threshold",
  "under_high_lambda",
  "market_suspended",
]);

/** Minimal shape of one `ModelRun.features.evaluatedPicks` entry — matches
 * `EvaluatedPickSnapshot` (apps/backend/src/utils/model-run.utils.ts) and
 * `EvaPickFromFeature` structurally, without importing either (this package
 * never depends on an app). `probability`/`odds` are strings because that's
 * what's actually persisted in the JSON snapshot (Decimal serialised to
 * string) — see readSnapshotNumber above for the parse. */
export type EvaluatedMarketPick = {
  market: string;
  pick: string;
  status: "viable" | "rejected";
  probability: string;
  odds: string;
  rejectionReason?: string;
};

export type ResolvedEvaluatedMarketLeg = {
  canal: StrategyChannel;
  probability: number;
  oddsSnapshot: number;
  wasViable: boolean;
};

// Decides whether one ModelRun.features.evaluatedPicks entry becomes an
// extra coupon-eligible candidate — pulled out as a pure function so the
// gating logic (dedup, canal mapping, AVOID) is unit-testable without
// mocking the whole Prisma/odds-loader pipeline the real coupon pool
// (apps/backend/src/modules/coupon/coupon-pool.service.ts) runs inside.
export function resolveEvaluatedMarketLeg(
  evaluated: EvaluatedMarketPick,
  opts: {
    stakedKeys: ReadonlySet<string>;
    enforceAvoid: boolean;
    calibrationAlert: boolean;
    /**
     * Also admit a 'rejected' pick when its rejectionReason is EV/odds-only
     * (see RELIABILITY_REJECTION_REASONS) — off by default so the existing
     * real coupon pool (getPoolForRange's includeEvaluatedMarkets) keeps its
     * current viable-only behaviour unchanged. Set by the LLM candidate pool
     * (docs/vantage-centric-redesign-2026-09-01.md §9 point 1), which needs
     * the full evaluatedPicks population, not just what already cleared the
     * single-bet EV floor.
     */
    includeEvRejected?: boolean;
  },
): ResolvedEvaluatedMarketLeg | null {
  const wasViable = evaluated.status === "viable";
  if (!wasViable) {
    const reason = evaluated.rejectionReason;
    const isReliabilityRejection =
      reason === undefined || RELIABILITY_REJECTION_REASONS.has(reason);
    if (!opts.includeEvRejected || isReliabilityRejection) return null;
  }
  const canal = EVALUATED_MARKET_CANAL[evaluated.market];
  if (!canal) return null; // CORRECT_SCORE and anything unmapped — excluded
  if (opts.stakedKeys.has(`${evaluated.market}:${evaluated.pick}`)) return null;

  const probability = readSnapshotNumber(evaluated.probability);
  const oddsSnapshot = readSnapshotNumber(evaluated.odds);
  if (probability === null || oddsSnapshot === null) return null;

  if (opts.enforceAvoid) {
    const regime = classifyAvoidSignal(
      isExtremeDivergence(probability, oddsSnapshot),
      opts.calibrationAlert,
    );
    // FADE has no dedicated opposite-leg construction here (unlike the Bet
    // loop in coupon-pool.service.ts, which can look up the opposite pick's
    // fresh odds from the live snapshot) — treated like DROP.
    if (regime === "DROP" || regime === "FADE") return null;
  }

  return { canal, probability, oddsSnapshot, wasViable };
}
