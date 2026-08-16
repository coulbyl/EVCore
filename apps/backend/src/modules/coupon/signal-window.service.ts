import { Injectable } from '@nestjs/common';
import { Market, StrategyChannel } from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';
import { CalibrationService } from '@modules/adjustment/calibration.service';
import { OddsSnapshotLoader } from '@modules/betting-engine/pricing/odds-snapshot.loader';
import {
  bookmakerMargin as computeBookmakerMargin,
  calculateEV,
  removeOverround,
} from '@modules/betting-engine/betting-engine.utils';
import { getPickOddsFromSnapshot } from '@modules/betting-engine/pricing/odds-mapping';
import { AVOID_CONFIG } from '@modules/betting-engine/strategies/channel-strategy.config';
import type { FullOddsSnapshot } from '@modules/betting-engine/betting-engine.types';
import {
  computeDataCoverage,
  extractEvaContextFromFeatures,
  extractModelRunFeatureDiagnostics,
  hasCalibrationAlert,
  readShadowConflict,
  type EvaluatedPickSnapshot,
} from '@utils/model-run.utils';
import {
  MAX_VIRTUAL_COUPON_SELECTIONS,
  type CouponChannel,
  type VirtualCouponChannel,
  BTTS_STAKED_LEAGUES,
  DRAW_STAKED_LEAGUES,
  CANAL_BASE_WEIGHT,
  COUPON_PARAMS,
  EVALUATED_MARKET_CANAL,
  VIRTUAL_COUPON_RULES,
  VIRTUAL_COUPON_TOP_LIMITS,
  type VirtualCouponRule,
} from './coupon.constants';

export type Canal = CouponChannel;

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

type ChannelSelectionCandidate = {
  channel: StrategyChannel;
  selections: Array<{
    market: Market;
    pick: string;
    probability: Decimal;
    odds: Decimal | null;
  }>;
};

// Picks the rank-1 selection for a given channel out of the channelDecisions
// relation loaded by getTodayPool (one decision per channel per ModelRun,
// @@unique([modelRunId, channel])).
function findChannelSelection(
  channelDecisions: ChannelSelectionCandidate[],
  channel: StrategyChannel,
) {
  return channelDecisions.find((cd) => cd.channel === channel)?.selections[0];
}

const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

/**
 * Per-market mean signed calibration error, keyed by `Market` enum value.
 * `meanError = mean(probEstimated - outcome)` — positive = model overconfidence.
 * Only markets with ≥ MIN_BET_COUNT settled bets are present (others fall back to
 * the legacy blend at scoring time).
 */
export type MarketCalibration = Record<
  string,
  { meanError: number; betCount: number }
>;

export type SignalWindow = {
  calibratedCanalHitRates: Record<Canal, number>;
  calibratedCanalLeagueHitRates: Record<Canal, Record<string, number>>;
  canalDowFactors: Record<Canal, Record<string, number | null>>;
  marketCalibration: MarketCalibration;
};

export type GetPoolOpts = {
  includeDraw?: boolean;
  includeTeamTotal?: boolean;
  includeBtts?: boolean;
  enforceAvoid?: boolean;
  /**
   * Stake the FADE regime's opposite pick instead of dropping it. Default
   * off — n=15-17 barely clears MIN_SAMPLE (cf.
   * backtest-coupon-quality-signals, 2026-08-09); leave disabled until more
   * settled data confirms it.
   */
  enableAvoidFade?: boolean;
  /**
   * Widen the real coupon pool with `ModelRun.features.evaluatedPicks`
   * ('viable' entries not already staked as a Bet/promoted channelDecision)
   * — see `EVALUATED_MARKET_CANAL` doc (coupon.constants.ts) for why this is
   * a legitimate coupon candidate, not a reliability rejection. Default off
   * — these legs have never appeared in a real coupon before; requires a
   * dedicated backtest (STAKED vs EVALUATED ROI) before flipping to true.
   */
  includeEvaluatedMarkets?: boolean;
};

export type ScoredPick = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  country: string;
  scheduledAt: Date;
  /** Fixture's own scheduled day (`YYYY-MM-DD`, UTC) — anti-correlation cap
   * across a multi-day pool (weekend/midweek windows) keys on this. */
  dayBucket: string;
  canal: Canal;
  market: string;
  pick: string;
  probability: number;
  calibratedHitRate: number;
  /**
   * Market-calibrated leg probability set by `CouponComposerService.scorePicks()`.
   * `null` until scoring runs (or for picks that bypass the composer).
   */
  calibratedProbability: number | null;
  oddsSnapshot: number | null;
  /**
   * EV de la jambe `calculateEV(calibratedProbability, oddsSnapshot)`, posé par
   * `CouponComposerService.scorePicks()`. `null` tant que le scoring n'a pas tourné
   * ou si la jambe n'a pas de cote réelle (jamais d'EV sur cote inventée).
   */
  legEV: number | null;
  /**
   * Proba « fair » marché de l'issue sélectionnée — overround retiré
   * (`removeOverround` sur les cotes d'issues du marché). `null` si les cotes
   * sœurs du marché sont indisponibles. Posée par `getTodayPool` (dépend des
   * cotes uniquement).
   */
  pMarketFair: number | null;
  /** Marge bookmaker du marché de la jambe (`Σ 1/cote − 1`). `null` si indispo. */
  bookmakerMargin: number | null;
  /**
   * Edge marché = `calibratedProbability − pMarketFair`, posé par `scorePicks()`.
   * `null` tant que le scoring n'a pas tourné ou si `pMarketFair` est indispo.
   */
  edge: number | null;
  lambdaHome: number | null;
  lambdaAway: number | null;
  xg: number | null;
  finalScore: number | null;
  modelThreshold: number | null;
  recentForm: number | null;
  modelProbabilities: Record<string, number>;
  /** Fraction (0-1) des 3 signaux shadow (line movement/H2H/congestion) présents. */
  dataCoverage: number | null;
  /** `shadow_predictions.conflict` — désaccord Poisson API-Football vs λ interne. */
  shadowConflict: boolean | null;
  offensiveBalance: 'BALANCED' | 'ASYMMETRIC' | 'STRONGLY_ASYMMETRIC' | null;
  /**
   * Nombre de ModelRun antérieurs (sur les 5 derniers) où ce même (market, pick)
   * était déjà la sélection retenue — signal de stabilité dans le temps
   * (validé +8% ROI à 6+ passes vs -12.5% à 1-3 passes, cf. plan coupon 2026-08-09).
   */
  priorAnalysisCount: number;
  isCorrect: boolean | null;
  signalScore: number;
  /**
   * `STAKED` = déjà matérialisé comme `Bet`/`channelDecision` promu (chemin
   * historique). `EVALUATED` = trouvé dans `evaluatedPicks` (`status:
   * 'viable'`) mais jamais officiellement retenu par son canal — n'a jamais
   * existé en coupon avant `opts.includeEvaluatedMarkets` (2026-08-16),
   * traçabilité pour un futur backtest dédié comparant les deux.
   */
  pickSource: 'STAKED' | 'EVALUATED';
  featureSnapshot: Record<string, unknown>;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeHtScore: number | null;
  awayHtScore: number | null;
  /** ID du bet MODEL existant (SAFE/EV uniquement). */
  betId: string | null;
  /** ID du ModelRun source (BTTS/DRAW/DOMINANT — pour création d'un bet USER). */
  modelRunId: string | null;
};

export type VirtualScoredPick = Omit<ScoredPick, 'canal'> & {
  canal: VirtualCouponChannel;
  virtualLabel: string;
};

function readNumber(features: unknown, key: string): number | null {
  if (!features || typeof features !== 'object') return null;
  const v = (features as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

type PriorRun = {
  bets: Array<{ market: Market; pick: string }>;
  channelDecisions: Array<{
    selections: Array<{ market: Market; pick: string }>;
  }>;
};

// Number of the fixture's earlier ModelRun passes (oldest excluded via slice(1)
// upstream) where this exact (market, pick) was already the retained selection —
// stability signal, validated +8% ROI at 6+ confirming passes vs -12.5% at 1-3
// (cf. plan coupon 2026-08-09).
function countPriorAnalyses(
  priorRuns: PriorRun[],
  market: Market,
  pick: string,
): number {
  return priorRuns.filter(
    (run) =>
      run.bets.some((b) => b.market === market && b.pick === pick) ||
      run.channelDecisions.some((cd) =>
        cd.selections.some((s) => s.market === market && s.pick === pick),
      ),
  ).length;
}

function readModelProbabilities(features: unknown): Record<string, number> {
  if (!features || typeof features !== 'object') return {};
  const probs = (features as Record<string, unknown>)['probabilities'];
  if (!probs || typeof probs !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(probs as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

function readSnapshotNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value.replace('%', ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getVirtualRule(input: {
  market: string;
  pick: string;
  probability: number;
  odds: number | null;
}): VirtualCouponRule | null {
  const { market, pick, probability, odds } = input;
  return (
    VIRTUAL_COUPON_RULES.find((rule) => {
      if (rule.market !== market || rule.pick !== pick) return false;
      if (probability < rule.minProbability) return false;
      if (probability >= rule.maxProbability) return false;
      if (!rule.allowMissingOdds && odds === null) return false;
      if (odds !== null && rule.minOdds !== undefined && odds < rule.minOdds) {
        return false;
      }
      if (odds !== null && rule.maxOdds !== undefined && odds >= rule.maxOdds) {
        return false;
      }
      return true;
    }) ?? null
  );
}

function scoreVirtualPick(input: {
  rule: VirtualCouponRule;
  competitionCode: string;
  probability: number;
  odds: number | null;
}): number {
  const leagueBoost = input.rule.leagueBoosts?.[input.competitionCode] ?? 0;
  const oddsPenalty =
    input.odds === null ? 0 : Math.max(0, input.odds - 1.4) * 0.02;
  return (
    input.rule.prior + leagueBoost + input.probability * 0.08 - oddsPenalty
  );
}

function resolveVirtualPickCorrect(input: {
  market: string;
  pick: string;
  homeScore: number | null;
  awayScore: number | null;
  homeHtScore: number | null;
  awayHtScore: number | null;
}): boolean | null {
  const { market, pick, homeScore, awayScore, homeHtScore, awayHtScore } =
    input;

  if (market === 'BTTS') {
    if (homeScore === null || awayScore === null) return null;
    if (pick === 'YES') return homeScore > 0 && awayScore > 0;
    if (pick === 'NO') return homeScore === 0 || awayScore === 0;
  }

  if (market === 'OVER_UNDER') {
    if (homeScore === null || awayScore === null) return null;
    const total = homeScore + awayScore;
    if (pick === 'OVER_1_5') return total > 1;
    if (pick === 'UNDER_1_5') return total <= 1;
    if (pick === 'OVER') return total > 2;
    if (pick === 'UNDER') return total <= 2;
    if (pick === 'OVER_3_5') return total > 3;
    if (pick === 'UNDER_3_5') return total <= 3;
    if (pick === 'OVER_4_5') return total > 4;
    if (pick === 'UNDER_4_5') return total <= 4;
  }

  if (market === 'OVER_UNDER_HT') {
    if (homeHtScore === null || awayHtScore === null) return null;
    const total = homeHtScore + awayHtScore;
    if (pick === 'OVER_0_5') return total > 0;
    if (pick === 'UNDER_0_5') return total <= 0;
    if (pick === 'OVER_1_5') return total > 1;
    if (pick === 'UNDER_1_5') return total <= 1;
  }

  return null;
}

type AggEntry = {
  canal: Canal;
  correct: boolean;
  dow: number;
  league: string;
  count: number;
  day: Date;
};

function decayWeight(
  dayMs: number,
  nowMs: number,
  halfLifeDays: number,
): number {
  const daysAgo = (nowMs - dayMs) / 86400000;
  return Math.pow(0.5, daysAgo / halfLifeDays);
}

// eslint-disable-next-line max-params
function hitsForWeighted(
  entries: AggEntry[],
  filter: (e: AggEntry) => boolean,
  nowMs: number,
  halfLifeDays: number,
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (const e of entries) {
    if (!filter(e)) continue;
    const w = decayWeight(e.day.getTime(), nowMs, halfLifeDays) * e.count;
    total += w;
    if (e.correct) correct += w;
  }
  return { correct, total };
}

function calibrate(
  weightedCorrect: number,
  weightedTotal: number,
  prior: number,
): number {
  const { k, capMin, capMax } = COUPON_PARAMS;
  const raw = (weightedCorrect + k * prior) / (weightedTotal + k);
  return Math.min(capMax, Math.max(capMin, raw));
}

// Opposite pick of an OVER_UNDER(_HT) line — pairs OVER_x with UNDER_x to recover
// the two mutually-exclusive outcomes needed to remove the overround. The 2.5
// line uses the bare 'OVER' / 'UNDER' keys (cf. FullOddsSnapshot.overUnderOdds).
function overUnderOpposite(pick: string): string | null {
  if (pick === 'OVER') return 'UNDER';
  if (pick === 'UNDER') return 'OVER';
  if (pick.startsWith('OVER_')) return `UNDER_${pick.slice('OVER_'.length)}`;
  if (pick.startsWith('UNDER_')) return `OVER_${pick.slice('UNDER_'.length)}`;
  return null;
}

// AVOID regime for a leg, from its two independent signals — validated on
// settled MODEL bets (2026-08-09 plan): neither signal alone is a reliable
// fade (extreme divergence alone: -16.7% ROI on the original pick but +19.3%
// on its opposite over n=32; calibration alert alone: -14.2%/-19.9% on
// either side, no edge, n=55) — but BOTH together flip back to the original
// pick being excellent (+51% ROI, n=32). A plain OR (today's binary AVOID)
// throws away that last case.
export type AvoidRegime = 'CLEAN' | 'FADE' | 'DROP' | 'KEEP';

export function classifyAvoidSignal(
  extremeDivergence: boolean,
  calibrationAlert: boolean,
): AvoidRegime {
  if (!extremeDivergence && !calibrationAlert) return 'CLEAN';
  if (extremeDivergence && calibrationAlert) return 'KEEP';
  return extremeDivergence ? 'FADE' : 'DROP';
}

// Two-outcome opposite of a pick, for markets where "fade the model" means
// literally staking the other side — a strict superset of overUnderOpposite
// (also covers OVER_UNDER_HT/TEAM_TOTAL_HOME/TEAM_TOTAL_AWAY, which share the
// same OVER_x/UNDER_x pick naming) plus the YES/NO markets. `null` for
// three-way or non-exhaustive markets (ONE_X_TWO, DOUBLE_CHANCE, ...) — no
// clean fade exists there, per the plan's scope.
function oppositePick(pick: string): string | null {
  if (pick === 'YES') return 'NO';
  if (pick === 'NO') return 'YES';
  return overUnderOpposite(pick);
}

// Sibling outcome odds for a market+pick — the OTHER mutually-exclusive outcomes,
// needed alongside the selected odds to remove the bookmaker margin. Returns
// `null` (skip fair-prob) when the market has no clean exhaustive partition here
// (DOUBLE_CHANCE overlaps; HALF_TIME_FULL_TIME coverage is too partial).
function siblingOutcomeOdds(
  market: Market,
  pick: string,
  snapshot: FullOddsSnapshot,
): Decimal[] | null {
  const pickOdds = (p: string): Decimal | null =>
    getPickOddsFromSnapshot(market, p, snapshot);

  if (market === Market.ONE_X_TWO || market === Market.FIRST_HALF_WINNER) {
    const others = ['HOME', 'DRAW', 'AWAY'].filter((p) => p !== pick);
    if (others.length !== 2) return null;
    const odds = others.map(pickOdds);
    return odds.every((o): o is Decimal => o !== null) ? odds : null;
  }
  if (market === Market.BTTS) {
    const other = pick === 'YES' ? 'NO' : pick === 'NO' ? 'YES' : null;
    const o = other ? pickOdds(other) : null;
    return o ? [o] : null;
  }
  if (market === Market.OVER_UNDER || market === Market.OVER_UNDER_HT) {
    const opposite = overUnderOpposite(pick);
    const o = opposite ? pickOdds(opposite) : null;
    return o ? [o] : null;
  }
  return null;
}

// Fair (overround-removed) probability of the selected outcome + the market's
// bookmaker margin. Depends on odds only — computed at pool-build time. Returns
// `null` when the full outcome set is unavailable or the odds are invalid.
export function computeMarketFair(
  market: Market,
  pick: string,
  snapshot: FullOddsSnapshot,
): { pMarketFair: number; bookmakerMargin: number } | null {
  const selected = getPickOddsFromSnapshot(market, pick, snapshot);
  if (selected === null) return null;
  const siblings = siblingOutcomeOdds(market, pick, snapshot);
  if (siblings === null || siblings.length === 0) return null;

  const outcomeOdds = [selected, ...siblings];
  try {
    const fair = removeOverround(outcomeOdds);
    const selectedFair = fair[0];
    if (selectedFair === undefined) return null;
    return {
      pMarketFair: selectedFair.toNumber(),
      bookmakerMargin: computeBookmakerMargin(outcomeOdds).toNumber(),
    };
  } catch {
    // Invalid decimal odds (≤ 1) — skip fair-prob rather than fail the pool.
    return null;
  }
}

// Decides whether one ModelRun.features.evaluatedPicks entry becomes an
// extra coupon-eligible candidate (opts.includeEvaluatedMarkets) — pulled out
// as a pure function so the gating logic (dedup, canal mapping, AVOID) is
// unit-testable without mocking the whole Prisma/odds-loader pipeline that
// getPoolForRange runs inside. See EVALUATED_MARKET_CANAL doc
// (coupon.constants.ts) for why 'viable'-but-not-staked is a legitimate
// candidate, not a reliability rejection.
export function resolveEvaluatedMarketLeg(
  evaluated: Pick<
    EvaluatedPickSnapshot,
    'market' | 'pick' | 'status' | 'probability' | 'odds'
  >,
  opts: {
    stakedKeys: ReadonlySet<string>;
    enforceAvoid: boolean;
    calibrationAlert: boolean;
  },
): { canal: Canal; probability: number; oddsSnapshot: number } | null {
  if (evaluated.status !== 'viable') return null;
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
    // loop, which can look up the opposite pick's fresh odds from the live
    // snapshot) — treated like DROP, same as pushChannelSelectionPick above.
    if (regime === 'DROP' || regime === 'FADE') return null;
  }

  return { canal: canal, probability, oddsSnapshot };
}

@Injectable()
export class SignalWindowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calibration: CalibrationService,
    private readonly oddsLoader: OddsSnapshotLoader,
  ) {}

  /**
   * @param asOf point-in-time cutoff — only fixtures played strictly before this
   *   instant feed the calibration. Defaults to "now" (live generation). Pass the
   *   target day's start to make the signal reproducible and leak-free when
   *   (re)generating for a past or specific date.
   */
  async computeSignalWindow(
    windowDays: number,
    asOf: Date = new Date(),
  ): Promise<SignalWindow> {
    const nowMs = asOf.getTime();
    const since = new Date(nowMs - windowDays * 24 * 60 * 60 * 1000);
    const halfLifeDays = COUPON_PARAMS.decayHalfLifeDays;

    type BetAggRow = {
      day: Date;
      channel: StrategyChannel;
      is_won: boolean;
      dow: number;
      league: string;
      cnt: bigint;
    };
    // Window + leak guard are on f."scheduledAt" (when the result became known),
    // consistent with the recency decay which keys on the fixture day. The
    // channel filter is intentionally absent: every canal is calibrated from its
    // own settled MODEL bets, and canals with no sample fall back to their
    // CANAL_BASE_WEIGHT prior via calibrate() (B6).
    const betRows = await this.prisma.client.$queryRaw<BetAggRow[]>`
      SELECT
        DATE(f."scheduledAt")                                   AS day,
        cd.channel                                              AS channel,
        (b.status = 'WON')                                      AS is_won,
        (EXTRACT(ISODOW FROM f."scheduledAt")::int - 1)         AS dow,
        c.code                                                  AS league,
        COUNT(*)                                                AS cnt
      FROM bet b
      JOIN channel_selection cs ON cs.id = b."channelSelectionId"
      JOIN channel_decision  cd ON cd.id = cs."channelDecisionId"
      JOIN fixture     f ON f.id = b."fixtureId"
      JOIN season      s ON s.id = f."seasonId"
      JOIN competition c ON c.id = s."competitionId"
      WHERE b.status IN ('WON', 'LOST')
        AND f."scheduledAt" >= ${since}
        AND f."scheduledAt" < ${asOf}
        AND b.source = 'MODEL'
      GROUP BY DATE(f."scheduledAt"), cd.channel, b.status,
               EXTRACT(ISODOW FROM f."scheduledAt"), c.code
    `;

    const entries: AggEntry[] = [];

    for (const r of betRows) {
      entries.push({
        canal: r.channel as Canal,
        correct: r.is_won,
        dow: Number(r.dow),
        league: r.league,
        count: Number(r.cnt),
        day: r.day,
      });
    }

    const canals: Canal[] = [
      'VALUE',
      'SAFE',
      'BTTS',
      'DRAW',
      'DOMINANT',
      'TEAM_TOTAL',
    ];

    const calibratedCanalHitRates = Object.fromEntries(
      canals.map((c) => {
        const prior = CANAL_BASE_WEIGHT[c];
        const { correct, total } = hitsForWeighted(
          entries,
          (e) => e.canal === c,
          nowMs,
          halfLifeDays,
        );
        return [c, calibrate(correct, total, prior)];
      }),
    ) as Record<Canal, number>;

    const canalDowFactors = Object.fromEntries(
      canals.map((c) => {
        const dowMap = Object.fromEntries(
          DOW_LABELS.map((label, i) => {
            const { correct, total } = hitsForWeighted(
              entries,
              (e) => e.canal === c && e.dow === i,
              nowMs,
              halfLifeDays,
            );
            return [label, total > 0 ? correct / total : null];
          }),
        );
        return [c, dowMap];
      }),
    ) as Record<Canal, Record<string, number | null>>;

    const allLeagues = [...new Set(entries.map((e) => e.league))];
    const calibratedCanalLeagueHitRates = Object.fromEntries(
      canals.map((c) => {
        const canalPrior = calibratedCanalHitRates[c];
        const leagueMap = Object.fromEntries(
          allLeagues.map((l) => {
            const { correct, total } = hitsForWeighted(
              entries,
              (e) => e.canal === c && e.league === l,
              nowMs,
              halfLifeDays,
            );
            return [l, calibrate(correct, total, canalPrior)];
          }),
        );
        return [c, leagueMap];
      }),
    ) as Record<Canal, Record<string, number>>;

    const marketResults = await this.calibration.computeAllMarkets({ asOf });
    const marketCalibration: MarketCalibration = {};
    for (const [market, result] of Object.entries(marketResults)) {
      if (result) {
        marketCalibration[market] = {
          meanError: result.meanError.toNumber(),
          betCount: result.betCount,
        };
      }
    }

    return {
      calibratedCanalHitRates,
      calibratedCanalLeagueHitRates,
      canalDowFactors,
      marketCalibration,
    };
  }

  /**
   * REAL coupon pool (B7) — the staking-eligible source. It reads only `Bet`
   * rows of source `MODEL`, which the engine materialises **for EV/SAFE** (the two
   * channels measured +ROI, cf. DESIGN.md B-ROI). DOMINANT is NOT materialised
   * as MODEL bets, so beyond EV/SAFE this pool only grows via explicit
   * `channel_selection`-based promotions:
   *
   * - DOMINANT is a **prediction-only** channel (ROI −2.1%, EV anti-predictive)
   *   → tracked via `channel_selection`, never staked.
   * - DRAW (aggregate ROI hides a per-league spread of +41% to -45% — see
   *   `DRAW_STAKED_LEAGUES`) is promoted **only for those leagues** when
   *   `includeDraw` is set; other leagues stay observation-only.
   * - TEAM_TOTAL (+3.40% ROI, n=845, all leagues — no league has enough volume
   *   to segment yet) is promoted the same way when `includeTeamTotal` is set.
   * - BTTS (aggregate ROI hides a per-league split too — see
   *   `BTTS_STAKED_LEAGUES`) is promoted **only for those leagues** when
   *   `includeBtts` is set; other leagues stay observation-only.
   *
   * The separate {@link getTodayVirtualPool} is a **prediction/observation** pool
   * (virtual SAFE/BTTS rules), kept distinct on purpose — it never stakes.
   */
  async getTodayPool(
    date: string,
    opts: GetPoolOpts = {},
  ): Promise<ScoredPick[]> {
    return this.getPoolForRange(date, date, opts);
  }

  /**
   * {@link getTodayPool}, extended to a `[fromDate, toDate]` window (inclusive,
   * both in `date` form) — the weekend (Fri→Sun) / midweek European-nights
   * (Tue→Thu) coupon windows read fixtures across several days here instead of
   * one `getTodayPool` call per day. Every {@link ScoredPick} carries a
   * `dayBucket` (the fixture's own scheduled day) so composition can still
   * apply a per-day anti-correlation cap on top of the existing per-fixture/
   * per-canal-market/per-competition ones.
   */
  async getPoolForRange(
    fromDate: string,
    toDate: string,
    opts: GetPoolOpts = {},
  ): Promise<ScoredPick[]> {
    const dayStart = new Date(`${fromDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${toDate}T23:59:59.999Z`);

    const fixtures = await this.prisma.client.fixture.findMany({
      where: { scheduledAt: { gte: dayStart, lte: dayEnd } },
      select: {
        id: true,
        scheduledAt: true,
        homeScore: true,
        awayScore: true,
        homeHtScore: true,
        awayHtScore: true,
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        season: {
          select: {
            competition: { select: { code: true, name: true, country: true } },
          },
        },
        modelRuns: {
          select: {
            id: true,
            finalScore: true,
            features: true,
            analyzedAt: true,
            bets: {
              where: { source: 'MODEL' },
              select: {
                id: true,
                market: true,
                pick: true,
                ev: true,
                qualityScore: true,
                probEstimated: true,
                oddsSnapshot: true,
                status: true,
                channelSelection: {
                  select: { channelDecision: { select: { channel: true } } },
                },
              },
            },
            // DRAW/TEAM_TOTAL/BTTS are staking channels (B7 promotions) but
            // aren't materialised as MODEL Bets — read their selection straight
            // from channel_selection so they can enter the real pool. Each is
            // gated by its own opts.include* flag (see findChannelSelection below).
            channelDecisions: {
              where: {
                channel: {
                  in: [
                    StrategyChannel.DRAW,
                    StrategyChannel.TEAM_TOTAL,
                    StrategyChannel.BTTS,
                  ],
                },
              },
              select: {
                channel: true,
                selections: {
                  where: { rank: 1, odds: { not: null } },
                  select: {
                    market: true,
                    pick: true,
                    probability: true,
                    odds: true,
                  },
                  take: 1,
                },
              },
              take: 3,
            },
          },
          orderBy: { analyzedAt: 'desc' },
          // 6 passes covers the deepest history observed in analysis sheets
          // (ADVANCE re-runs over the rolling horizon window) — modelRuns[0] is
          // the current run, modelRuns[1..] feed priorAnalysisCount below.
          take: 6,
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const MODEL_THRESHOLD: Record<string, number> = {
      PL: 0.58,
      SA: 0.6,
      BL1: 0.55,
      LL: 0.58,
      L1: 0.58,
      J1: 0.55,
      MX1: 0.55,
      CH: 0.5,
      D2: 0.55,
      F2: 0.58,
      SP2: 0.62,
      I2: 0.6,
      EL1: 0.5,
      EL2: 0.45,
      UCL: 0.45,
      LDC: 0.45,
      UEL: 0.55,
      UECL: 0.45,
      WCQE: 0.6,
      FRI: 0.45,
      UNL: 0.6,
      // Conservative — recalibrate after 20+ observed matches.
      WC: 0.52,
    };

    // One batched query for every fixture's odds instead of one per fixture
    // (findLatestOddsSnapshot alone runs ~34 sequential Prisma calls each) —
    // condition of viability once the pool spans more than a single day.
    const oddsSnapshots = await this.oddsLoader.findLatestOddsSnapshotsBatch(
      fixtures
        .filter((f) => f.modelRuns[0])
        .map((f) => ({ fixtureId: f.id, cutoff: f.scheduledAt })),
    );

    const picks: ScoredPick[] = [];

    for (const f of fixtures) {
      const run = f.modelRuns[0];
      const priorRuns = f.modelRuns.slice(1);
      const comp = f.season.competition.code;
      const competitionName = f.season.competition.name;
      const country = f.season.competition.country;
      const feat = run?.features;
      const lambdaHome = readNumber(feat, 'lambdaHome');
      const lambdaAway = readNumber(feat, 'lambdaAway');
      const xg =
        lambdaHome !== null && lambdaAway !== null
          ? lambdaHome + lambdaAway
          : null;
      const finalScore = run?.finalScore ? Number(run.finalScore) : null;
      const modelThreshold = MODEL_THRESHOLD[comp] ?? 0.6;

      const recentForm = readNumber(feat, 'recentForm');
      const modelProbabilities = readModelProbabilities(feat);
      const dataCoverage =
        feat !== undefined ? computeDataCoverage(feat) : null;
      const shadowConflict =
        feat !== undefined ? readShadowConflict(feat) : null;
      const offensiveBalance =
        feat !== undefined
          ? (extractEvaContextFromFeatures(feat).offensiveBalance
              ?.classification ?? null)
          : null;

      const base = {
        fixtureId: f.id,
        homeTeam: f.homeTeam.name,
        awayTeam: f.awayTeam.name,
        homeLogo: f.homeTeam.logoUrl ?? null,
        awayLogo: f.awayTeam.logoUrl ?? null,
        competition: competitionName,
        country,
        scheduledAt: f.scheduledAt,
        dayBucket: f.scheduledAt.toISOString().slice(0, 10),
        homeScore: f.homeScore ?? null,
        awayScore: f.awayScore ?? null,
        homeHtScore: f.homeHtScore ?? null,
        awayHtScore: f.awayHtScore ?? null,
        legEV: null, // set in CouponComposerService.scorePicks()
        edge: null, // set in CouponComposerService.scorePicks()
        lambdaHome,
        lambdaAway,
        xg,
        finalScore,
        modelThreshold,
        recentForm,
        modelProbabilities,
        dataCoverage,
        shadowConflict,
        offensiveBalance,
        featureSnapshot: {
          lambdaHome,
          lambdaAway,
          xg,
          finalScore,
          modelThreshold,
          recentForm,
          competitionCode: comp,
          dataCoverage,
          shadowConflict,
          offensiveBalance,
        } as Record<string, unknown>,
      };

      // AVOID/calibration routing (graduated — replaces the old blanket
      // fixture-level drop). Validated on settled MODEL bets (plan
      // 2026-08-09): CLEAN and KEEP stake the original pick, DROP stakes
      // nothing, FADE stakes the opposite pick only when opts.enableAvoidFade
      // is explicitly set (shadow by default — see classifyAvoidSignal).
      const calibAlert = hasCalibrationAlert(feat);

      if (run) {
        // Full market odds (as-of kickoff) — needed to remove the overround and
        // compute each leg's fair market probability + bookmaker margin.
        const snapshot = oddsSnapshots.get(f.id) ?? null;
        // Every (market, pick) already staked for this fixture (Bet or
        // promoted channelDecision) — dedupe against when expanding into
        // evaluatedPicks below (opts.includeEvaluatedMarkets).
        const stakedKeys = new Set<string>();

        for (const bet of run.bets) {
          const betOdds = bet.oddsSnapshot ? Number(bet.oddsSnapshot) : null;
          const extremeDiv = isExtremeDivergence(
            Number(bet.probEstimated),
            betOdds,
          );
          const regime = opts.enforceAvoid
            ? classifyAvoidSignal(extremeDiv, calibAlert)
            : 'CLEAN';
          if (regime === 'DROP') continue;

          let market = bet.market;
          let pick = bet.pick;
          let probability = Number(bet.probEstimated);
          let legOdds = betOdds;
          // bet.status settles the ORIGINAL pick — for a faded leg the
          // opposite won exactly when the original lost.
          let isCorrect =
            bet.status === 'WON' ? true : bet.status === 'LOST' ? false : null;

          if (regime === 'FADE') {
            const opp = oppositePick(bet.pick);
            const oppOdds =
              opp && snapshot
                ? getPickOddsFromSnapshot(bet.market, opp, snapshot)
                : null;
            if (!opts.enableAvoidFade || opp === null || oppOdds === null) {
              continue; // shadow-only for now — same net effect as DROP
            }
            market = bet.market;
            pick = opp;
            probability = 1 - probability;
            legOdds = oppOdds.toNumber();
            isCorrect =
              bet.status === 'LOST'
                ? true
                : bet.status === 'WON'
                  ? false
                  : null;
          }

          const channel =
            bet.channelSelection?.channelDecision.channel ??
            StrategyChannel.VALUE;
          const canal: Canal = channel as Canal;
          const fair = snapshot
            ? computeMarketFair(market, pick, snapshot)
            : null;
          picks.push({
            ...base,
            canal,
            market,
            pick,
            probability,
            calibratedHitRate: 0, // set in CouponComposerService.scorePicks()
            calibratedProbability: null, // set in CouponComposerService.scorePicks()
            oddsSnapshot: legOdds,
            pMarketFair: fair?.pMarketFair ?? null,
            bookmakerMargin: fair?.bookmakerMargin ?? null,
            // A faded leg is a synthetic pick the model never actually
            // selected across prior passes — no history to count.
            priorAnalysisCount:
              regime === 'FADE'
                ? 0
                : countPriorAnalyses(priorRuns, bet.market, bet.pick),
            isCorrect,
            signalScore: 0,
            betId: bet.id,
            modelRunId: null,
            pickSource: 'STAKED',
          });
          stakedKeys.add(`${market}:${pick}`);
        }

        // DRAW/TEAM_TOTAL/BTTS staking (B7 promotions) — these channels' selections
        // live in channel_selection, not in MODEL bets, so read them here to make
        // each a real, staking-eligible pool leg when its opts.include* flag is set.
        const pushChannelSelectionPick = (channel: StrategyChannel) => {
          const sel = findChannelSelection(run.channelDecisions, channel);
          if (!sel || sel.odds === null) return;
          // Same graduated AVOID routing as the bets loop above, applied to
          // the promoted channels (DRAW/TEAM_TOTAL/BTTS) — FADE stays
          // shadow-only here too (no dedicated opposite-leg construction for
          // these channels yet, only DROP/KEEP/CLEAN are actionable).
          const regime = opts.enforceAvoid
            ? classifyAvoidSignal(
                isExtremeDivergence(Number(sel.probability), Number(sel.odds)),
                calibAlert,
              )
            : 'CLEAN';
          if (regime === 'DROP' || regime === 'FADE') return;
          const fair = snapshot
            ? computeMarketFair(sel.market, sel.pick, snapshot)
            : null;
          picks.push({
            ...base,
            canal: channel as Canal,
            market: sel.market,
            pick: sel.pick,
            probability: Number(sel.probability),
            calibratedHitRate: 0,
            calibratedProbability: null,
            oddsSnapshot: Number(sel.odds),
            pMarketFair: fair?.pMarketFair ?? null,
            bookmakerMargin: fair?.bookmakerMargin ?? null,
            priorAnalysisCount: countPriorAnalyses(
              priorRuns,
              sel.market,
              sel.pick,
            ),
            isCorrect: null,
            signalScore: 0,
            betId: null,
            modelRunId: run.id,
            pickSource: 'STAKED',
          });
          stakedKeys.add(`${sel.market}:${sel.pick}`);
        };

        // Restricted to DRAW_STAKED_LEAGUES — see that constant's doc comment.
        if (
          opts.includeDraw &&
          (DRAW_STAKED_LEAGUES as readonly string[]).includes(comp)
        ) {
          pushChannelSelectionPick(StrategyChannel.DRAW);
        }
        // +3.40% ROI (n=845), all leagues — no league has enough volume yet to
        // segment (db:backtest:team-total-btts-competition, 2026-07-28).
        if (opts.includeTeamTotal) {
          pushChannelSelectionPick(StrategyChannel.TEAM_TOTAL);
        }
        // Restricted to BTTS_STAKED_LEAGUES — see that constant's doc comment.
        if (
          opts.includeBtts &&
          (BTTS_STAKED_LEAGUES as readonly string[]).includes(comp)
        ) {
          pushChannelSelectionPick(StrategyChannel.BTTS);
        }

        // Widen the real pool with viable-but-not-officially-staked
        // evaluatedPicks (opts.includeEvaluatedMarkets) — see
        // EVALUATED_MARKET_CANAL doc (coupon.constants.ts) for why a
        // 'viable' entry is a legitimate coupon candidate even though its own
        // channel didn't select it as the winner among this fixture's markets.
        if (opts.includeEvaluatedMarkets) {
          const evaluatedPicks = extractModelRunFeatureDiagnostics(
            run.features,
          ).evaluatedPicks;
          for (const evaluated of evaluatedPicks) {
            const resolved = resolveEvaluatedMarketLeg(evaluated, {
              stakedKeys,
              enforceAvoid: opts.enforceAvoid ?? false,
              calibrationAlert: calibAlert,
            });
            if (!resolved) continue;
            const { canal, probability, oddsSnapshot: legOdds } = resolved;
            const fair = snapshot
              ? computeMarketFair(
                  evaluated.market as Market,
                  evaluated.pick,
                  snapshot,
                )
              : null;
            picks.push({
              ...base,
              canal,
              market: evaluated.market,
              pick: evaluated.pick,
              probability,
              calibratedHitRate: 0,
              calibratedProbability: null,
              oddsSnapshot: legOdds,
              legEV: calculateEV(probability, legOdds).toNumber(),
              pMarketFair: fair?.pMarketFair ?? null,
              bookmakerMargin: fair?.bookmakerMargin ?? null,
              priorAnalysisCount: countPriorAnalyses(
                priorRuns,
                evaluated.market as Market,
                evaluated.pick,
              ),
              isCorrect: null,
              signalScore: 0,
              betId: null,
              modelRunId: run.id,
              pickSource: 'EVALUATED',
            });
          }
        }
      }
    }

    return picks;
  }

  /**
   * VIRTUAL coupon pool (B7) — **prediction/observation only, never staked**.
   * Built from the `VIRTUAL_COUPON_RULES` (heuristic SAFE/BTTS-style markets) over
   * the day's fixtures, independent of any materialised `Bet`. Kept deliberately
   * separate from the real {@link getTodayPool}: it exists to observe candidate
   * strategies (e.g. BTTS, HT overs) before they ever justify real stakes. Promote
   * a virtual channel to the real pool only after a green per-channel backtest.
   */
  async getTodayVirtualPool(date: string): Promise<VirtualScoredPick[]> {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const fixtures = await this.prisma.client.fixture.findMany({
      where: { scheduledAt: { gte: dayStart, lte: dayEnd } },
      select: {
        id: true,
        scheduledAt: true,
        homeScore: true,
        awayScore: true,
        homeHtScore: true,
        awayHtScore: true,
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        season: {
          select: {
            competition: { select: { code: true, name: true, country: true } },
          },
        },
        modelRuns: {
          select: {
            id: true,
            finalScore: true,
            features: true,
            analyzedAt: true,
          },
          orderBy: { analyzedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const picks: VirtualScoredPick[] = [];

    for (const f of fixtures) {
      const run = f.modelRuns[0];
      if (!run) continue;

      const comp = f.season.competition.code;
      const competitionName = f.season.competition.name;
      const country = f.season.competition.country;
      const feat = run.features;
      const lambdaHome = readNumber(feat, 'lambdaHome');
      const lambdaAway = readNumber(feat, 'lambdaAway');
      const xg =
        lambdaHome !== null && lambdaAway !== null
          ? lambdaHome + lambdaAway
          : null;
      const finalScore = run.finalScore ? Number(run.finalScore) : null;
      const recentForm = readNumber(feat, 'recentForm');
      const modelProbabilities = readModelProbabilities(feat);
      const dataCoverage = computeDataCoverage(feat);
      const shadowConflict = readShadowConflict(feat);
      const offensiveBalance =
        extractEvaContextFromFeatures(feat).offensiveBalance?.classification ??
        null;
      const evaluatedPicks = extractModelRunFeatureDiagnostics(
        run.features,
      ).evaluatedPicks;

      for (const evaluated of evaluatedPicks) {
        if (evaluated.status !== 'viable') continue;
        const probability = readSnapshotNumber(evaluated.probability);
        const odds = readSnapshotNumber(evaluated.odds);
        if (probability === null) continue;

        const rule = getVirtualRule({
          market: evaluated.market,
          pick: evaluated.pick,
          probability,
          odds,
        });
        if (!rule) continue;

        const signalScore = scoreVirtualPick({
          rule,
          competitionCode: comp,
          probability,
          odds,
        });
        const calibratedHitRate = Math.min(
          COUPON_PARAMS.capMax,
          Math.max(
            COUPON_PARAMS.capMin,
            rule.prior + (rule.leagueBoosts?.[comp] ?? 0),
          ),
        );

        picks.push({
          fixtureId: f.id,
          homeTeam: f.homeTeam.name,
          awayTeam: f.awayTeam.name,
          homeLogo: f.homeTeam.logoUrl ?? null,
          awayLogo: f.awayTeam.logoUrl ?? null,
          competition: competitionName,
          country,
          scheduledAt: f.scheduledAt,
          dayBucket: f.scheduledAt.toISOString().slice(0, 10),
          homeScore: f.homeScore ?? null,
          awayScore: f.awayScore ?? null,
          homeHtScore: f.homeHtScore ?? null,
          awayHtScore: f.awayHtScore ?? null,
          legEV: null, // set in CouponComposerService.scorePicks()
          pMarketFair: null,
          bookmakerMargin: null,
          edge: null, // set in CouponComposerService.scorePicks()
          lambdaHome,
          lambdaAway,
          xg,
          finalScore,
          modelThreshold: null,
          recentForm,
          modelProbabilities,
          dataCoverage,
          shadowConflict,
          offensiveBalance,
          // Not queried here (single-pass pool, prediction-only — never staked).
          priorAnalysisCount: 0,
          featureSnapshot: {
            lambdaHome,
            lambdaAway,
            xg,
            finalScore,
            recentForm,
            competitionCode: comp,
            virtualRule: rule.canal,
            virtualLabel: rule.label,
          },
          canal: rule.canal,
          virtualLabel: rule.label,
          market: evaluated.market,
          pick: evaluated.pick,
          probability,
          calibratedHitRate,
          calibratedProbability: null,
          oddsSnapshot: odds,
          isCorrect: resolveVirtualPickCorrect({
            market: evaluated.market,
            pick: evaluated.pick,
            homeScore: f.homeScore ?? null,
            awayScore: f.awayScore ?? null,
            homeHtScore: f.homeHtScore ?? null,
            awayHtScore: f.awayHtScore ?? null,
          }),
          signalScore,
          betId: null,
          modelRunId: run.id,
          pickSource: 'STAKED', // virtual pool — never gated by pickSource anyway
        });
      }
    }

    const selected: VirtualScoredPick[] = [];
    const counts = new Map<VirtualCouponChannel, number>();
    const seenFixturesByCanal = new Set<string>();

    for (const pick of picks.sort((a, b) => b.signalScore - a.signalScore)) {
      const count = counts.get(pick.canal) ?? 0;
      if (count >= MAX_VIRTUAL_COUPON_SELECTIONS[pick.canal]) continue;

      const uniqueKey = `${pick.canal}:${pick.fixtureId}`;
      if (seenFixturesByCanal.has(uniqueKey)) continue;

      selected.push(pick);
      counts.set(pick.canal, count + 1);
      seenFixturesByCanal.add(uniqueKey);
    }

    return selected.slice(0, VIRTUAL_COUPON_TOP_LIMITS.top10 * 3);
  }
}
