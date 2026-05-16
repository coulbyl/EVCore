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

function hitRate(correct: number, total: number): number | null {
  return total > 0 ? correct / total : null;
}

type AggEntry = {
  canal: Canal;
  correct: boolean;
  dow: number; // Mon=0 … Sun=6
  league: string;
  count: number;
};

@Injectable()
export class SignalWindowService {
  constructor(private readonly prisma: PrismaService) {}

  async computeSignalWindow(windowDays: number): Promise<SignalWindow> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    type BetAggRow = {
      is_safe: boolean;
      is_won: boolean;
      dow: number;
      league: string;
      cnt: bigint;
    };
    type PredAggRow = {
      channel: string;
      correct: boolean;
      dow: number;
      league: string;
      cnt: bigint;
    };

    // Aggregate at the DB level — never load individual rows into Node.js heap
    const [betRows, predRows] = await Promise.all([
      this.prisma.client.$queryRaw<BetAggRow[]>`
        SELECT
          b."isSafeValue"                                   AS is_safe,
          (b.status = 'WON')                                AS is_won,
          (EXTRACT(ISODOW FROM f."scheduledAt")::int - 1)  AS dow,
          c.code                                            AS league,
          COUNT(*)                                          AS cnt
        FROM bet b
        JOIN fixture     f ON f.id = b."fixtureId"
        JOIN season      s ON s.id = f."seasonId"
        JOIN competition c ON c.id = s."competitionId"
        WHERE b.status IN ('WON', 'LOST')
          AND b."createdAt" >= ${since}
          AND b.source = 'MODEL'
        GROUP BY b."isSafeValue", b.status,
                 EXTRACT(ISODOW FROM f."scheduledAt"), c.code
      `,
      this.prisma.client.$queryRaw<PredAggRow[]>`
        SELECT
          p.channel                                         AS channel,
          p.correct                                         AS correct,
          (EXTRACT(ISODOW FROM f."scheduledAt")::int - 1)  AS dow,
          p.competition                                     AS league,
          COUNT(*)                                          AS cnt
        FROM prediction p
        JOIN fixture f ON f.id = p."fixtureId"
        WHERE p.correct IS NOT NULL
          AND p."createdAt" >= ${since}
          AND p.channel IN ('BTTS', 'DRAW', 'CONF')
        GROUP BY p.channel, p.correct,
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
      });
    }

    const canals: Canal[] = ['EV', 'SV', 'BB', 'NUL', 'CONF'];

    function hitsFor(filter: (e: AggEntry) => boolean): {
      correct: number;
      total: number;
    } {
      let correct = 0;
      let total = 0;
      for (const e of entries) {
        if (!filter(e)) continue;
        total += e.count;
        if (e.correct) correct += e.count;
      }
      return { correct, total };
    }

    const canalHitRates = Object.fromEntries(
      canals.map((c) => {
        const { correct, total } = hitsFor((e) => e.canal === c);
        return [c, hitRate(correct, total)];
      }),
    ) as Record<Canal, number | null>;

    const canalDowFactors = Object.fromEntries(
      canals.map((c) => {
        const dowMap = Object.fromEntries(
          DOW_LABELS.map((label, i) => {
            const { correct, total } = hitsFor(
              (e) => e.canal === c && e.dow === i,
            );
            return [label, hitRate(correct, total)];
          }),
        );
        return [c, dowMap];
      }),
    ) as Record<Canal, Record<string, number | null>>;

    const allLeagues = [...new Set(entries.map((e) => e.league))];
    const canalLeagueHitRates = Object.fromEntries(
      canals.map((c) => {
        const leagueMap = Object.fromEntries(
          allLeagues.map((l) => {
            const { correct, total } = hitsFor(
              (e) => e.canal === c && e.league === l,
            );
            return [l, hitRate(correct, total)];
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
      // Seuil conservateur — pas de backtest disponible sur confrontations inter-confederation.
      // Recalibrer après 20+ matchs observés. N'affecte aucune autre ligue.
      WC26: 0.52,
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
