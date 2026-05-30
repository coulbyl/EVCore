import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { extractModelRunFeatureDiagnostics } from '@utils/model-run.utils';
import {
  type InvestmentCanal,
  CANAL_BASE_WEIGHT,
  INVESTMENT_PARAMS,
} from './investment.constants';

export type Canal = InvestmentCanal;

const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

export type SignalWindow = {
  calibratedCanalHitRates: Record<Canal, number>;
  calibratedCanalLeagueHitRates: Record<Canal, Record<string, number>>;
  canalDowFactors: Record<Canal, Record<string, number | null>>;
};

export type ScoredPick = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  country: string;
  scheduledAt: Date;
  canal: Canal;
  market: string;
  pick: string;
  probability: number;
  calibratedHitRate: number;
  oddsSnapshot: number | null;
  lambdaHome: number | null;
  lambdaAway: number | null;
  xg: number | null;
  finalScore: number | null;
  modelThreshold: number | null;
  recentForm: number | null;
  modelProbabilities: Record<string, number>;
  isCorrect: boolean | null;
  signalScore: number;
  featureSnapshot: Record<string, unknown>;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeHtScore: number | null;
  awayHtScore: number | null;
  /** ID du bet MODEL existant (SV/EV uniquement). */
  betId: string | null;
  /** ID du ModelRun source (BB/NUL/CONF — pour création d'un bet USER). */
  modelRunId: string | null;
};

function readNumber(features: unknown, key: string): number | null {
  if (!features || typeof features !== 'object') return null;
  const v = (features as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
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
  const { k, capMin, capMax } = INVESTMENT_PARAMS;
  const raw = (weightedCorrect + k * prior) / (weightedTotal + k);
  return Math.min(capMax, Math.max(capMin, raw));
}

@Injectable()
export class SignalWindowService {
  constructor(private readonly prisma: PrismaService) {}

  async computeSignalWindow(windowDays: number): Promise<SignalWindow> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const nowMs = Date.now();
    const halfLifeDays = INVESTMENT_PARAMS.decayHalfLifeDays;

    type BetAggRow = {
      day: Date;
      is_safe: boolean;
      is_won: boolean;
      dow: number;
      league: string;
      cnt: bigint;
    };
    type PredAggRow = {
      day: Date;
      channel: string;
      correct: boolean;
      dow: number;
      league: string;
      cnt: bigint;
    };

    const [betRows, predRows] = await Promise.all([
      this.prisma.client.$queryRaw<BetAggRow[]>`
        SELECT
          DATE(f."scheduledAt")                                   AS day,
          b."isSafeValue"                                         AS is_safe,
          (b.status = 'WON')                                      AS is_won,
          (EXTRACT(ISODOW FROM f."scheduledAt")::int - 1)         AS dow,
          c.code                                                  AS league,
          COUNT(*)                                                AS cnt
        FROM bet b
        JOIN fixture     f ON f.id = b."fixtureId"
        JOIN season      s ON s.id = f."seasonId"
        JOIN competition c ON c.id = s."competitionId"
        WHERE b.status IN ('WON', 'LOST')
          AND b."createdAt" >= ${since}
          AND b.source = 'MODEL'
        GROUP BY DATE(f."scheduledAt"), b."isSafeValue", b.status,
                 EXTRACT(ISODOW FROM f."scheduledAt"), c.code
      `,
      this.prisma.client.$queryRaw<PredAggRow[]>`
        SELECT
          DATE(f."scheduledAt")                                   AS day,
          p.channel                                               AS channel,
          p.correct                                               AS correct,
          (EXTRACT(ISODOW FROM f."scheduledAt")::int - 1)         AS dow,
          p.competition                                           AS league,
          COUNT(*)                                               AS cnt
        FROM prediction p
        JOIN fixture f ON f.id = p."fixtureId"
        WHERE p.correct IS NOT NULL
          AND p."createdAt" >= ${since}
          AND p.channel IN ('BTTS', 'DRAW', 'CONF')
        GROUP BY DATE(f."scheduledAt"), p.channel, p.correct,
                 EXTRACT(ISODOW FROM f."scheduledAt"), p.competition
      `,
    ]);

    const entries: AggEntry[] = [];

    for (const r of betRows) {
      entries.push({
        canal: r.is_safe ? 'SV' : 'EV',
        correct: r.is_won,
        dow: Number(r.dow),
        league: r.league,
        count: Number(r.cnt),
        day: r.day,
      });
    }

    for (const r of predRows) {
      const canal: Canal =
        r.channel === 'BTTS' ? 'BB' : r.channel === 'DRAW' ? 'NUL' : 'CONF';
      entries.push({
        canal,
        correct: r.correct,
        dow: Number(r.dow),
        league: r.league,
        count: Number(r.cnt),
        day: r.day,
      });
    }

    const canals: Canal[] = ['EV', 'SV', 'BB', 'NUL', 'CONF'];

    // Canal-level calibrated rates (bayesian smoothing + exponential decay)
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

    // DOW factors (raw rates, fallback to null — caller applies canal-level fallback)
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

    // League-level calibrated rates (prior = canal-level calibrated rate)
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

    return {
      calibratedCanalHitRates,
      calibratedCanalLeagueHitRates,
      canalDowFactors,
    };
  }

  async getTodayPool(date: string): Promise<ScoredPick[]> {
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
                isSafeValue: true,
                status: true,
              },
            },
          },
          orderBy: { analyzedAt: 'desc' },
          take: 1,
        },
        predictions: {
          select: {
            channel: true,
            market: true,
            pick: true,
            probability: true,
            correct: true,
          },
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
      WC26: 0.52,
    };

    const picks: ScoredPick[] = [];

    for (const f of fixtures) {
      const run = f.modelRuns[0];
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

      const base = {
        fixtureId: f.id,
        homeTeam: f.homeTeam.name,
        awayTeam: f.awayTeam.name,
        homeLogo: f.homeTeam.logoUrl ?? null,
        awayLogo: f.awayTeam.logoUrl ?? null,
        competition: competitionName,
        country,
        scheduledAt: f.scheduledAt,
        homeScore: f.homeScore ?? null,
        awayScore: f.awayScore ?? null,
        homeHtScore: f.homeHtScore ?? null,
        awayHtScore: f.awayHtScore ?? null,
        lambdaHome,
        lambdaAway,
        xg,
        finalScore,
        modelThreshold,
        recentForm,
        modelProbabilities,
        featureSnapshot: {
          lambdaHome,
          lambdaAway,
          xg,
          finalScore,
          modelThreshold,
          recentForm,
        } as Record<string, unknown>,
      };

      const evaluatedPicks = run
        ? extractModelRunFeatureDiagnostics(run.features).evaluatedPicks
        : [];

      if (run) {
        for (const bet of run.bets) {
          const canal: Canal = bet.isSafeValue ? 'SV' : 'EV';
          const isCorrect =
            bet.status === 'WON' ? true : bet.status === 'LOST' ? false : null;
          picks.push({
            ...base,
            canal,
            market: bet.market,
            pick: bet.pick,
            probability: Number(bet.probEstimated),
            calibratedHitRate: 0, // set in CouponComposerService.scorePicks()
            oddsSnapshot: bet.oddsSnapshot ? Number(bet.oddsSnapshot) : null,
            isCorrect,
            signalScore: 0,
            betId: bet.id,
            modelRunId: null,
          });
        }
      }

      for (const pred of f.predictions) {
        if (
          pred.channel !== 'BTTS' &&
          pred.channel !== 'DRAW' &&
          pred.channel !== 'CONF'
        )
          continue;
        const canal: Canal =
          pred.channel === 'BTTS'
            ? 'BB'
            : pred.channel === 'DRAW'
              ? 'NUL'
              : 'CONF';

        const targetMarket = pred.channel === 'BTTS' ? 'BTTS' : 'ONE_X_TWO';
        const evalSnap = evaluatedPicks.find(
          (ep) => ep.market === targetMarket && ep.pick === pred.pick,
        );
        const oddsSnapshot = evalSnap?.odds ? Number(evalSnap.odds) : null;

        picks.push({
          ...base,
          canal,
          market: pred.market,
          pick: pred.pick,
          probability: Number(pred.probability),
          calibratedHitRate: 0,
          oddsSnapshot,
          isCorrect: pred.correct ?? null,
          signalScore: 0,
          betId: null,
          modelRunId: run?.id ?? null,
        });
      }
    }

    return picks;
  }
}
