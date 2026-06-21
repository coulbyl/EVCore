import { Injectable } from '@nestjs/common';
import { StrategyChannel } from '@evcore/db';
import { parseIsoDate, startOfUtcDay, endOfUtcDay } from '@utils/date.utils';
import { CouponRepository } from './coupon.repository';
import type { CouponSummaryCanal } from './dto/coupon-summary-query.dto';
import type {
  CouponSummaryPickRow,
  CouponSummaryRow,
  CouponSummaryProgressionPoint,
  CouponSummaryResponse,
  CouponSummaryStats,
} from './dto/coupon-summary.dto';
import { type CouponChannel, MAX_COUPON_SELECTIONS } from './coupon.constants';

function buildProgression(
  items: { date: string; result: 'WON' | 'LOST' }[],
): CouponSummaryProgressionPoint[] {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map<string, { won: number; lost: number }>();
  for (const item of sorted) {
    const entry = byDate.get(item.date) ?? { won: 0, lost: 0 };
    if (item.result === 'WON') entry.won += 1;
    else entry.lost += 1;
    byDate.set(item.date, entry);
  }
  let cumWon = 0;
  let cumLost = 0;
  const points: CouponSummaryProgressionPoint[] = [];
  for (const [date, { won, lost }] of byDate) {
    cumWon += won;
    cumLost += lost;
    points.push({ date, won: cumWon, lost: cumLost });
  }
  return points;
}

function computeRoi(items: { odds: number | null; result: 'WON' | 'LOST' }[]): {
  roi: string | null;
  roiPickCount: number;
} {
  const withOdds = items.filter((i) => i.odds !== null);
  if (!withOdds.length) return { roi: null, roiPickCount: 0 };
  const totalReturned = withOdds.reduce((acc, i) => {
    return i.result === 'WON' && i.odds !== null ? acc + i.odds : acc;
  }, 0);
  const net = totalReturned - withOdds.length;
  const pct = (net / withOdds.length) * 100;
  return {
    roi: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
    roiPickCount: withOdds.length,
  };
}

function dateRange(
  from: string | undefined,
  to: string | undefined,
): { from: Date; to: Date } {
  const today = new Date();
  const toDate = to
    ? endOfUtcDay(parseIsoDate(to))
    : endOfUtcDay(new Date(today.getTime() - 86_400_000));
  const fromDate = from
    ? startOfUtcDay(parseIsoDate(from))
    : startOfUtcDay(new Date(today.getTime() - 7 * 86_400_000));
  return { from: fromDate, to: toDate };
}

// eslint-disable-next-line max-params
function capByDay<T>(
  items: T[],
  getDate: (item: T) => string,
  getScore: (item: T) => number,
  maxPerDay: number,
): T[] {
  const byDate = new Map<string, T[]>();
  for (const item of items) {
    const date = getDate(item);
    const bucket = byDate.get(date) ?? [];
    bucket.push(item);
    byDate.set(date, bucket);
  }
  const result: T[] = [];
  for (const bucket of byDate.values()) {
    const sorted = [...bucket].sort((a, b) => getScore(b) - getScore(a));
    result.push(...sorted.slice(0, maxPerDay));
  }
  return result;
}

@Injectable()
export class CouponSummaryService {
  constructor(private readonly repo: CouponRepository) {}

  async getCouponSummary(query: {
    canal: CouponSummaryCanal;
    from?: string;
    to?: string;
  }): Promise<CouponSummaryResponse> {
    const { canal } = query;

    if (canal === 'COUPON') {
      return this.buildCouponSummary(query.from, query.to);
    }

    return this.buildPickSummary(canal, query.from, query.to);
  }

  private async buildPickSummary(
    canal: Exclude<CouponSummaryCanal, 'COUPON'>,
    from: string | undefined,
    to: string | undefined,
  ): Promise<CouponSummaryResponse> {
    const range = dateRange(from, to);
    const maxPerDay = MAX_COUPON_SELECTIONS[canal as CouponChannel];

    let picks: CouponSummaryPickRow[];

    if (canal === 'EV' || canal === 'SAFE') {
      const bets = await this.repo.findSettledBetsForSummary({
        channel: canal === 'SAFE' ? StrategyChannel.SAFE : StrategyChannel.EV,
        from: range.from,
        to: range.to,
      });

      const capped = capByDay(
        bets,
        (b) => b.fixture.scheduledAt.toISOString().slice(0, 10),
        (b) =>
          b.qualityScore !== null
            ? Number(b.qualityScore)
            : Number(b.probEstimated),
        maxPerDay,
      );

      picks = capped.map(
        (b): CouponSummaryPickRow => ({
          fixtureId: b.fixture.id,
          fixture: `${b.fixture.homeTeam.name} vs ${b.fixture.awayTeam.name}`,
          homeLogo: b.fixture.homeTeam.logoUrl ?? null,
          awayLogo: b.fixture.awayTeam.logoUrl ?? null,
          competition: b.fixture.season.competition.name,
          scheduledAt: b.fixture.scheduledAt.toISOString(),
          canal,
          market: b.market,
          pick: b.pick,
          odds: b.oddsSnapshot?.toString() ?? null,
          result: b.status === 'WON' ? 'WON' : 'LOST',
        }),
      );
    } else {
      picks = [];
    }

    const won = picks.filter((p) => p.result === 'WON');
    const lost = picks.filter((p) => p.result === 'LOST');

    const { roi, roiPickCount } = computeRoi(
      picks.map((p) => ({
        odds: p.odds !== null ? parseFloat(p.odds) : null,
        result: p.result,
      })),
    );

    const stats: CouponSummaryStats = {
      total: picks.length,
      won: won.length,
      lost: lost.length,
      roi,
      roiPickCount,
    };

    const sorted = [
      ...won.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
      ...lost.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
    ];

    return {
      canal,
      stats,
      progression: buildProgression(
        picks.map((p) => ({
          date: p.scheduledAt.slice(0, 10),
          result: p.result,
        })),
      ),
      picks: sorted,
      coupons: [],
    };
  }

  private async buildCouponSummary(
    from: string | undefined,
    to: string | undefined,
  ): Promise<CouponSummaryResponse> {
    const range = dateRange(from, to);
    const proposals = await this.repo.findResolvedCouponsInRange(
      range.from,
      range.to,
    );

    const coupons: CouponSummaryRow[] = proposals
      .filter((p) => p.result === 'WON' || p.result === 'LOST')
      .map((p) => ({
        id: p.id,
        forDate: p.forDate.toISOString().slice(0, 10),
        rank: p.rank,
        combinedOdds: Number(p.combinedOdds),
        jointProbability: Number(p.jointProbability),
        result: p.result as 'WON' | 'LOST',
        legs: p.legs.map((l) => ({
          fixtureId: l.fixtureId,
          fixture: `${l.fixture.homeTeam.name} vs ${l.fixture.awayTeam.name}`,
          homeLogo: l.fixture.homeTeam.logoUrl ?? null,
          awayLogo: l.fixture.awayTeam.logoUrl ?? null,
          competition: l.fixture.season.competition.code,
          scheduledAt: l.fixture.scheduledAt.toISOString(),
          canal: l.canal,
          market: l.market,
          pick: l.pick,
          odds: l.oddsSnapshot !== null ? Number(l.oddsSnapshot) : null,
          isCorrect: l.isCorrect ?? null,
        })),
      }));

    const won = coupons.filter((c) => c.result === 'WON');
    const lost = coupons.filter((c) => c.result === 'LOST');

    const { roi, roiPickCount } = computeRoi(
      coupons.map((c) => ({
        odds: c.combinedOdds,
        result: c.result,
      })),
    );

    const stats: CouponSummaryStats = {
      total: coupons.length,
      won: won.length,
      lost: lost.length,
      roi,
      roiPickCount,
    };

    const progression = buildProgression(
      coupons.map((c) => ({ date: c.forDate, result: c.result })),
    );

    const sorted = [
      ...won.sort((a, b) => b.forDate.localeCompare(a.forDate)),
      ...lost.sort((a, b) => b.forDate.localeCompare(a.forDate)),
    ];

    return {
      canal: 'COUPON',
      stats,
      progression,
      picks: [],
      coupons: sorted,
    };
  }
}
