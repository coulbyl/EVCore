import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { extractModelRunFeatureDiagnostics } from '@utils/model-run.utils';

export type Canal = 'EV' | 'SV' | 'BB' | 'NUL' | 'CONF';

const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

export type SignalWindow = {
  canalHitRates: Record<Canal, number | null>;
  canalDowFactors: Record<Canal, Record<string, number | null>>;
  canalLeagueHitRates: Record<Canal, Record<string, number | null>>;
};

export type ScoredPick = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  scheduledAt: Date;
  canal: Canal;
  market: string;
  pick: string;
  probability: number;
  oddsSnapshot: number | null;
  lambdaHome: number | null;
  lambdaAway: number | null;
  xg: number | null;
  finalScore: number | null;
  modelThreshold: number | null;
  signalScore: number;
  featureSnapshot: Record<string, unknown>;
};

function readNumber(features: unknown, key: string): number | null {
  if (!features || typeof features !== 'object') return null;
  const v = (features as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function hitRate(correct: number, incorrect: number): number | null {
  return correct + incorrect > 0 ? correct / (correct + incorrect) : null;
}

function dowIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
}

@Injectable()
export class SignalWindowService {
  constructor(private readonly prisma: PrismaService) {}

  async computeSignalWindow(windowDays: number): Promise<SignalWindow> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [bets, predictions] = await Promise.all([
      this.prisma.client.bet.findMany({
        where: {
          status: { in: ['WON', 'LOST'] },
          createdAt: { gte: since },
          source: 'MODEL',
        },
        select: {
          isSafeValue: true,
          status: true,
          fixture: {
            select: {
              scheduledAt: true,
              season: { select: { competition: { select: { code: true } } } },
            },
          },
        },
      }),
      this.prisma.client.prediction.findMany({
        where: {
          correct: { not: null },
          createdAt: { gte: since },
        },
        select: {
          channel: true,
          correct: true,
          competition: true,
          fixture: { select: { scheduledAt: true } },
        },
      }),
    ]);

    type Record_ = {
      canal: Canal;
      correct: boolean;
      dow: number;
      league: string;
    };
    const records: Record_[] = [];

    for (const b of bets) {
      const canal: Canal = b.isSafeValue ? 'SV' : 'EV';
      records.push({
        canal,
        correct: b.status === 'WON',
        dow: dowIndex(b.fixture.scheduledAt),
        league: b.fixture.season.competition.code,
      });
    }

    for (const p of predictions) {
      const canal: Canal =
        p.channel === 'BTTS' ? 'BB' : p.channel === 'DRAW' ? 'NUL' : 'CONF';
      records.push({
        canal,
        correct: p.correct === true,
        dow: dowIndex(p.fixture.scheduledAt),
        league: p.competition,
      });
    }

    const canals: Canal[] = ['EV', 'SV', 'BB', 'NUL', 'CONF'];

    const canalHitRates = Object.fromEntries(
      canals.map((c) => {
        const sub = records.filter((r) => r.canal === c);
        const correct = sub.filter((r) => r.correct).length;
        return [c, hitRate(correct, sub.length - correct)];
      }),
    ) as Record<Canal, number | null>;

    const canalDowFactors = Object.fromEntries(
      canals.map((c) => {
        const sub = records.filter((r) => r.canal === c);
        const dowMap = Object.fromEntries(
          DOW_LABELS.map((label, i) => {
            const d = sub.filter((r) => r.dow === i);
            const correct = d.filter((r) => r.correct).length;
            return [label, hitRate(correct, d.length - correct)];
          }),
        );
        return [c, dowMap];
      }),
    ) as Record<Canal, Record<string, number | null>>;

    const allLeagues = [...new Set(records.map((r) => r.league))];
    const canalLeagueHitRates = Object.fromEntries(
      canals.map((c) => {
        const leagueMap = Object.fromEntries(
          allLeagues.map((l) => {
            const sub = records.filter((r) => r.canal === c && r.league === l);
            const correct = sub.filter((r) => r.correct).length;
            return [l, hitRate(correct, sub.length - correct)];
          }),
        );
        return [c, leagueMap];
      }),
    ) as Record<Canal, Record<string, number | null>>;

    return { canalHitRates, canalDowFactors, canalLeagueHitRates };
  }

  async getTodayPool(date: string): Promise<ScoredPick[]> {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const fixtures = await this.prisma.client.fixture.findMany({
      where: { scheduledAt: { gte: dayStart, lte: dayEnd } },
      select: {
        id: true,
        scheduledAt: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        season: { select: { competition: { select: { code: true } } } },
        modelRuns: {
          select: {
            finalScore: true,
            features: true,
            analyzedAt: true,
            bets: {
              where: { source: 'MODEL' },
              select: {
                market: true,
                pick: true,
                ev: true,
                qualityScore: true,
                probEstimated: true,
                oddsSnapshot: true,
                isSafeValue: true,
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
    };

    const picks: ScoredPick[] = [];

    for (const f of fixtures) {
      const run = f.modelRuns[0];
      const comp = f.season.competition.code;
      const feat = run?.features;
      const lambdaHome = readNumber(feat, 'lambdaHome');
      const lambdaAway = readNumber(feat, 'lambdaAway');
      const xg =
        lambdaHome !== null && lambdaAway !== null
          ? lambdaHome + lambdaAway
          : null;
      const finalScore = run?.finalScore ? Number(run.finalScore) : null;
      const modelThreshold = MODEL_THRESHOLD[comp] ?? 0.6;

      const base = {
        fixtureId: f.id,
        homeTeam: f.homeTeam.name,
        awayTeam: f.awayTeam.name,
        competition: comp,
        scheduledAt: f.scheduledAt,
        lambdaHome,
        lambdaAway,
        xg,
        finalScore,
        modelThreshold,
        featureSnapshot: {
          lambdaHome,
          lambdaAway,
          xg,
          finalScore,
          modelThreshold,
        } as Record<string, unknown>,
      };

      const evaluatedPicks = run
        ? extractModelRunFeatureDiagnostics(run.features).evaluatedPicks
        : [];

      if (run) {
        for (const bet of run.bets) {
          const canal: Canal = bet.isSafeValue ? 'SV' : 'EV';
          picks.push({
            ...base,
            canal,
            market: bet.market,
            pick: bet.pick,
            probability: Number(bet.probEstimated),
            oddsSnapshot: bet.oddsSnapshot ? Number(bet.oddsSnapshot) : null,
            signalScore: 0, // computed in CouponComposerService
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
          oddsSnapshot,
          signalScore: 0,
        });
      }
    }

    return picks;
  }
}
