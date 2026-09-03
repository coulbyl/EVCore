import { Injectable } from '@nestjs/common';
import {
  BetStatus,
  ChannelDecisionStatus,
  Market,
  StrategyChannel,
} from '@evcore/db';
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
import {
  classifyAvoidSignal,
  isExtremeDivergence,
  resolveEvaluatedMarketLeg,
  type ChannelReliability,
  type ChannelReliabilityMap,
} from '@evcore/analysis-core';
import type { FullOddsSnapshot } from '@modules/betting-engine/betting-engine.types';
import {
  computeDataCoverage,
  extractEvaContextFromFeatures,
  extractModelRunFeatureDiagnostics,
  hasCalibrationAlert,
  readShadowConflict,
} from '@utils/model-run.utils';
import {
  type CouponChannel,
  DRAW_STAKED_LEAGUES,
  POOL_ELIGIBLE_CHANNELS,
} from './coupon.constants';

export type Canal = CouponChannel;

/**
 * Per-market mean signed calibration error, keyed by `Market` enum value.
 * `meanError = mean(probEstimated - outcome)` — positive = model overconfidence.
 * Only markets with ≥ MIN_BET_COUNT settled bets are present (others fall back to
 * the legacy blend at scoring time).
 *
 * A channel-aware, channel_decision/channel_selection-sourced version (per
 * (channel, market) instead of market-pooled across every channel) was tried
 * 2026-08-20 and reverted the same night — see calibrateLegProbability's doc
 * (coupon-composer.service.ts) for the backtested result and why.
 */
export type MarketCalibration = Record<
  string,
  { meanError: number; betCount: number }
>;

/**
 * Tout ce dont le scoring d'une jambe a besoin. Anciennement `SignalWindow`,
 * qui portait aussi des taux de réussite glissants sur 38 jours — voir
 * `computeLegCalibration` pour pourquoi ils ont été retirés.
 */
export type LegCalibration = {
  /** Courbes de Platt par canal — cf. CalibrationService.computeChannelReliability. */
  channelReliability: ChannelReliabilityMap;
  /** Courbe de repli pour un canal sans historique propre. */
  pooledReliability: ChannelReliability;
};

export type GetPoolOpts = {
  /**
   * Restrict DRAW legs to DRAW_STAKED_LEAGUES. DRAW is the only admitted
   * channel with a per-league whitelist (see that constant). TEAM_TOTAL's and
   * BTTS's equivalents went away with the 2026-08-22 pool switch: neither
   * channel clears the calibration-ratio bar in POOL_ELIGIBLE_CHANNELS any
   * more, so a flag scoping WHERE they stake would gate nothing.
   */
  includeDraw?: boolean;
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
   * — see `EVALUATED_MARKET_CANAL` doc (analysis-core's evaluated-market-leg.ts) for why this is
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
  /**
   * Cote de RÉFÉRENCE : celle de la maison la mieux classée (`bookmakerRank`,
   * Pinnacle d'abord). Sert à mesurer la divergence modèle↔marché
   * (`clearsMaxLegEdge`), jamais à miser. `oddsSnapshot` porte le prix de
   * mise, qui est le meilleur disponible et donc toujours >= celle-ci.
   */
  referenceOdds: number | null;
  /** Provenance: the `channel_selection` row this leg came from (`null`
   * for evaluatedPicks legs, which no channel selected). */
  channelSelectionId: string | null;
  /** ID du ModelRun source (BTTS/DRAW/DOMINANT — pour création d'un bet USER). */
  modelRunId: string | null;
};

function readNumber(features: unknown, key: string): number | null {
  if (!features || typeof features !== 'object') return null;
  const v = (features as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

type PriorRun = {
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
  // Reads channelDecisions only since 2026-08-22 — the `bets` arm it used to
  // OR against covered VALUE/SAFE, which now arrive through channelDecisions
  // like every other eligible channel. Net coverage is wider, not narrower:
  // prior runs used to expose 3 channels here, now they expose all of
  // POOL_ELIGIBLE_CHANNELS.
  return priorRuns.filter((run) =>
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

// Renamed from `SignalWindowService` 2026-09-03. The old name was a fossil:
// it dates from when this class computed a genuine rolling-window "signal
// score" (`calibratedCanalHitRates`/`canalDowFactors`/`signalScore`, 38-day
// window) — measured anti-predictive and removed entirely 2026-08-22 (see
// `computeLegCalibration`'s doc). What's left is leg-pool construction
// (`getPoolForRange`) plus a Platt-curve calibration window — no "signal",
// no "window" concept survives. A stale name here risks misleading a reader
// (or an LLM given this file as context) into assuming a live windowed
// heuristic still drives selection. Also dropped in the same pass: the
// unused `getTodayPool` wrapper and the entire virtual-coupon pool
// (`getTodayVirtualPool`/`VIRTUAL_COUPON_RULES` and dependents) — dead code,
// zero callers anywhere in the repo.
@Injectable()
export class CouponPoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calibration: CalibrationService,
    private readonly oddsLoader: OddsSnapshotLoader,
  ) {}

  /**
   * Calibration des jambes — courbes de fiabilité par canal, point-in-time.
   *
   * Remplace `computeSignalWindow(windowDays, asOf)` et toute la notion de
   * fenêtre glissante de 38 jours (supprimée le 2026-08-22).
   *
   * Ce que la fenêtre produisait :
   *   - `calibratedCanalHitRates`, `canalDowFactors`,
   *     `calibratedCanalLeagueHitRates` — des taux de réussite passés par
   *     (canal), (canal×jour), (canal×ligue), agrégés en `signalScore` ;
   *   - `marketCalibration` — un décalage moyen par marché.
   *
   * Pourquoi c'est parti :
   *   - `signalScore` a été mesuré ANTI-PRÉDICTIF à probabilité constante :
   *     0.681 (n=1120) contre 0.631 (n=1190) selon qu'il est bas ou haut,
   *     -5.0 points ± 2.0, et dans le même sens sur les quatre bandes de
   *     probabilité. Détail dans `CouponComposerService.scorePicks`.
   *   - la décomposition de variance dit pourquoi : (canal×jour×ligue) est le
   *     découpage où 88% de l'écart observé entre cases est du bruit.
   *     Sélectionner sur un taux passé bruité, c'est sélectionner la
   *     régression vers la moyenne.
   *   - `marketCalibration` avait déjà été remplacé par les courbes par canal
   *     (mauvaise forme — la courbe est plate, pas décalée — et mauvais
   *     groupement).
   *
   * Ce qui RESTE du passé, et qui marche : la courbe de fiabilité par canal.
   * La distinction est celle entre CALIBRER (transformer une probabilité
   * annoncée en probabilité honnête — ratio passé de 0.819 à 1.05-1.10) et
   * PRÉFÉRER (choisir une jambe plutôt qu'une autre sur son historique), qui
   * est ce qui échouait.
   *
   * @param asOf borne point-in-time — seules les rencontres jouées strictement
   *   avant cet instant alimentent la calibration. Défaut « maintenant »
   *   (génération live) ; passer le début du jour cible pour une régénération
   *   reproductible et sans fuite.
   */
  async computeLegCalibration(
    asOf: Date = new Date(),
  ): Promise<LegCalibration> {
    const { byChannel, pooled } =
      await this.calibration.computeChannelReliability({ asOf });
    return { channelReliability: byChannel, pooledReliability: pooled };
  }

  /**
   * REAL coupon pool (B7) — the staking-eligible source, over a
   * `[fromDate, toDate]` window (inclusive, both in `date` form; pass the
   * same date twice for a single day) — the weekend (Fri→Sun) / midweek
   * European-nights (Tue→Thu) coupon windows read fixtures across several
   * days here in one call. Every {@link ScoredPick} carries a `dayBucket`
   * (the fixture's own scheduled day) so composition can still apply a
   * per-day anti-correlation cap on top of the existing per-fixture/
   * per-canal-market/per-competition ones.
   *
   * Reads every {@link POOL_ELIGIBLE_CHANNELS} channel's own rank-1
   * `channel_selection`, plus (`opts.includeEvaluatedMarkets`) the wider raw
   * `evaluatedPicks` population per fixture. DOMINANT is a
   * **prediction-only** channel (ROI −2.1%, EV anti-predictive) — tracked
   * here like any other pool channel, never specially staked. DRAW
   * (aggregate ROI hides a per-league spread of +41% to -45% — see
   * `DRAW_STAKED_LEAGUES`) is promoted **only for those leagues** when
   * `includeDraw` is set; other leagues stay observation-only.
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
            // Single pool source (2026-08-22): every eligible channel's own
            // rank-1 selection, read straight from channel_selection. This
            // replaces a `bets` read (which `persistChannelBet` only ever
            // writes for VALUE/SAFE, so 2 channels could ever reach the pool
            // through it) plus a 3-channel DRAW/TEAM_TOTAL/BTTS special case.
            // See POOL_ELIGIBLE_CHANNELS (coupon.constants.ts) for what is
            // admitted and on what measured evidence.
            //
            // `odds: { not: null }` is a hard requirement, not a preference:
            // EVCore is value-driven and compose() rejects any leg without a
            // real odds snapshot anyway (no FALLBACK_ODDS since B2).
            channelDecisions: {
              where: {
                channel: { in: [...POOL_ELIGIBLE_CHANNELS] },
                status: ChannelDecisionStatus.SELECTED,
              },
              select: {
                channel: true,
                selections: {
                  where: { rank: 1, odds: { not: null } },
                  select: {
                    id: true,
                    market: true,
                    pick: true,
                    probability: true,
                    odds: true,
                    ev: true,
                    qualityScore: true,
                    result: true,
                  },
                  take: 1,
                },
              },
              take: POOL_ELIGIBLE_CHANNELS.length,
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
    const oddsTargets = fixtures
      .filter((f) => f.modelRuns[0])
      .map((f) => ({ fixtureId: f.id, cutoff: f.scheduledAt }));
    const [oddsSnapshots, bestPrices] = await Promise.all([
      this.oddsLoader.findLatestOddsSnapshotsBatch(oddsTargets),
      // Prix de MISE — la meilleure cote toutes maisons confondues, distincte
      // de la cote de RÉFÉRENCE ci-dessus (maison la plus juste). Voir
      // findBestPricesBatch pour pourquoi les deux doivent coexister.
      this.oddsLoader.findBestPricesBatch(oddsTargets),
    ]);

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
        // Every (market, pick) already contributed by a channel for this
        // fixture — dedupe against when expanding into evaluatedPicks below
        // (opts.includeEvaluatedMarkets).
        const stakedKeys = new Set<string>();

        // One loop over every eligible channel's rank-1 selection. Before
        // 2026-08-22 this was two divergent paths (a `bets` loop that owned
        // the AVOID FADE construction, and a pushChannelSelectionPick helper
        // that could only DROP) — the split meant VALUE/SAFE got a fade leg
        // while DRAW/TEAM_TOTAL/BTTS silently didn't. Now every channel goes
        // through the same regime handling.
        for (const decision of run.channelDecisions) {
          const sel = decision.selections[0];
          if (!sel || sel.odds === null) continue;

          // Per-league staking whitelists survive the unification — they are
          // backtested restrictions on WHERE a channel is trusted, not an
          // artefact of the old two-path structure.
          if (
            decision.channel === StrategyChannel.DRAW &&
            (!opts.includeDraw ||
              !(DRAW_STAKED_LEAGUES as readonly string[]).includes(comp))
          ) {
            continue;
          }
          const selOdds = Number(sel.odds);
          const regime = opts.enforceAvoid
            ? classifyAvoidSignal(
                isExtremeDivergence(Number(sel.probability), selOdds),
                calibAlert,
              )
            : 'CLEAN';
          if (regime === 'DROP') continue;

          const market = sel.market;
          let pick = sel.pick;
          let probability = Number(sel.probability);
          let legOdds = selOdds;
          // sel.result settles the ORIGINAL pick — for a faded leg the
          // opposite won exactly when the original lost.
          let isCorrect =
            sel.result === BetStatus.WON
              ? true
              : sel.result === BetStatus.LOST
                ? false
                : null;

          if (regime === 'FADE') {
            const opp = oppositePick(sel.pick);
            const oppOdds =
              opp && snapshot
                ? getPickOddsFromSnapshot(sel.market, opp, snapshot)
                : null;
            if (!opts.enableAvoidFade || opp === null || oppOdds === null) {
              continue; // shadow-only for now — same net effect as DROP
            }
            pick = opp;
            probability = 1 - probability;
            legOdds = oppOdds.toNumber();
            isCorrect =
              sel.result === BetStatus.LOST
                ? true
                : sel.result === BetStatus.WON
                  ? false
                  : null;
          }

          const fair = snapshot
            ? computeMarketFair(market, pick, snapshot)
            : null;
          // On mise au meilleur prix disponible, on mesure la divergence sur
          // la cote de référence — cf. findBestPricesBatch.
          const bestOdds = bestPrices.get(`${f.id}:${market}:${pick}`);
          const stakeOdds =
            bestOdds !== undefined && bestOdds > legOdds ? bestOdds : legOdds;

          picks.push({
            ...base,
            canal: decision.channel,
            market,
            pick,
            probability,
            calibratedHitRate: 0, // set in CouponComposerService.scorePicks()
            calibratedProbability: null, // set in CouponComposerService.scorePicks()
            oddsSnapshot: stakeOdds,
            referenceOdds: legOdds,
            pMarketFair: fair?.pMarketFair ?? null,
            bookmakerMargin: fair?.bookmakerMargin ?? null,
            // A faded leg is a synthetic pick the model never actually
            // selected across prior passes — no history to count.
            priorAnalysisCount:
              regime === 'FADE'
                ? 0
                : countPriorAnalyses(priorRuns, sel.market, sel.pick),
            isCorrect,
            signalScore: 0,
            channelSelectionId: sel.id,
            modelRunId: run.id,
            pickSource: 'STAKED',
          });
          stakedKeys.add(`${market}:${pick}`);
        }

        // Widen the real pool with viable-but-not-officially-staked
        // evaluatedPicks (opts.includeEvaluatedMarkets) — see
        // EVALUATED_MARKET_CANAL doc (analysis-core's evaluated-market-leg.ts) for why a
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
              // Chemin evaluatedPicks : la cote vient du diagnostic du
              // ModelRun, pas d'une sélection de canal — pas de meilleur prix
              // à substituer, la référence est donc la même.
              referenceOdds: legOdds,
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
              channelSelectionId: null,
              modelRunId: run.id,
              pickSource: 'EVALUATED',
            });
          }
        }
      }
    }

    return picks;
  }
}
