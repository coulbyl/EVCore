import { Injectable } from '@nestjs/common';
import { StrategyChannel } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { extractModelRunFeatureDiagnostics } from '@utils/model-run.utils';
import {
  MAX_VIRTUAL_INVESTMENT_SELECTIONS,
  type InvestmentCanal,
  type VirtualInvestmentCanal,
  CANAL_BASE_WEIGHT,
  INVESTMENT_PARAMS,
  VIRTUAL_INVESTMENT_RULES,
  VIRTUAL_INVESTMENT_TOP_LIMITS,
  type VirtualInvestmentRule,
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

export type VirtualScoredPick = Omit<ScoredPick, 'canal'> & {
  canal: VirtualInvestmentCanal;
  virtualLabel: string;
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
}): VirtualInvestmentRule | null {
  const { market, pick, probability, odds } = input;
  return (
    VIRTUAL_INVESTMENT_RULES.find((rule) => {
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
  rule: VirtualInvestmentRule;
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
      channel: StrategyChannel;
      is_won: boolean;
      dow: number;
      league: string;
      cnt: bigint;
    };
    const betRows = await this.prisma.client.$queryRaw<BetAggRow[]>`
      SELECT
        DATE(f."scheduledAt")                                   AS day,
        cs.channel                                              AS channel,
        (b.status = 'WON')                                      AS is_won,
        (EXTRACT(ISODOW FROM f."scheduledAt")::int - 1)         AS dow,
        c.code                                                  AS league,
        COUNT(*)                                                AS cnt
      FROM bet b
      JOIN channel_selection cs ON cs.id = b."channelSelectionId"
      JOIN fixture     f ON f.id = b."fixtureId"
      JOIN season      s ON s.id = f."seasonId"
      JOIN competition c ON c.id = s."competitionId"
      WHERE b.status IN ('WON', 'LOST')
        AND b."createdAt" >= ${since}
        AND b.source = 'MODEL'
        AND cs.channel IN ('EV', 'SAFE')
      GROUP BY DATE(f."scheduledAt"), cs.channel, b.status,
               EXTRACT(ISODOW FROM f."scheduledAt"), c.code
    `;

    const entries: AggEntry[] = [];

    for (const r of betRows) {
      entries.push({
        canal: r.channel === StrategyChannel.SAFE ? 'SV' : 'EV',
        correct: r.is_won,
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
                status: true,
                channelSelection: {
                  select: { channelDecision: { select: { channel: true } } },
                },
              },
            },
          },
          orderBy: { analyzedAt: 'desc' },
          take: 1,
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
          competitionCode: comp,
        } as Record<string, unknown>,
      };

      if (run) {
        for (const bet of run.bets) {
          const canal: Canal =
            bet.channelSelection?.channelDecision.channel ===
            StrategyChannel.SAFE
              ? 'SV'
              : 'EV';
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
    }

    return picks;
  }

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
          INVESTMENT_PARAMS.capMax,
          Math.max(
            INVESTMENT_PARAMS.capMin,
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
          homeScore: f.homeScore ?? null,
          awayScore: f.awayScore ?? null,
          homeHtScore: f.homeHtScore ?? null,
          awayHtScore: f.awayHtScore ?? null,
          lambdaHome,
          lambdaAway,
          xg,
          finalScore,
          modelThreshold: null,
          recentForm,
          modelProbabilities,
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
        });
      }
    }

    const selected: VirtualScoredPick[] = [];
    const counts = new Map<VirtualInvestmentCanal, number>();
    const seenFixturesByCanal = new Set<string>();

    for (const pick of picks.sort((a, b) => b.signalScore - a.signalScore)) {
      const count = counts.get(pick.canal) ?? 0;
      if (count >= MAX_VIRTUAL_INVESTMENT_SELECTIONS[pick.canal]) continue;

      const uniqueKey = `${pick.canal}:${pick.fixtureId}`;
      if (seenFixturesByCanal.has(uniqueKey)) continue;

      selected.push(pick);
      counts.set(pick.canal, count + 1);
      seenFixturesByCanal.add(uniqueKey);
    }

    return selected.slice(0, VIRTUAL_INVESTMENT_TOP_LIMITS.top10 * 3);
  }
}
