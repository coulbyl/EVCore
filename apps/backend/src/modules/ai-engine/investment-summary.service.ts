import { Injectable } from '@nestjs/common';
import { parseIsoDate, startOfUtcDay, endOfUtcDay } from '@utils/date.utils';
import { SummaryService } from '@modules/summary/summary.service';
import { AiEngineRepository } from './ai-engine.repository';
import type { InvestmentSummaryCanal } from './dto/investment-summary-query.dto';
import type {
  InvestmentSummaryPickRow,
  InvestmentSummaryCouponRow,
  InvestmentSummaryProgressionPoint,
  InvestmentSummaryResponse,
  InvestmentSummaryStats,
} from './dto/investment-summary.dto';
import type { SummaryChannel } from '@modules/summary/summary.types';

const CANAL_TO_CHANNEL: Record<
  Exclude<InvestmentSummaryCanal, 'COUPON'>,
  SummaryChannel
> = {
  EV: 'EV',
  SV: 'SV',
  BB: 'BTTS',
  NUL: 'DRAW',
  CONF: 'CONF',
};

const CHANNEL_TO_CANAL: Record<
  SummaryChannel,
  Exclude<InvestmentSummaryCanal, 'COUPON'>
> = {
  EV: 'EV',
  SV: 'SV',
  BTTS: 'BB',
  DRAW: 'NUL',
  CONF: 'CONF',
};

function buildProgression(
  items: { date: string; result: 'WON' | 'LOST' }[],
): InvestmentSummaryProgressionPoint[] {
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
  const points: InvestmentSummaryProgressionPoint[] = [];
  for (const [date, { won, lost }] of byDate) {
    cumWon += won;
    cumLost += lost;
    points.push({ date, won: cumWon, lost: cumLost });
  }
  return points;
}

function computeRoi(
  items: { odds: number | null; result: 'WON' | 'LOST' }[],
): { roi: string | null; roiPickCount: number } {
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

@Injectable()
export class InvestmentSummaryService {
  constructor(
    private readonly summary: SummaryService,
    private readonly repo: AiEngineRepository,
  ) {}

  async getInvestmentSummary(query: {
    canal: InvestmentSummaryCanal;
    from?: string;
    to?: string;
  }): Promise<InvestmentSummaryResponse> {
    const { canal } = query;

    if (canal === 'COUPON') {
      return this.buildCouponSummary(query.from, query.to);
    }

    return this.buildPickSummary(
      canal,
      query.from,
      query.to,
    );
  }

  private async buildPickSummary(
    canal: Exclude<InvestmentSummaryCanal, 'COUPON'>,
    from: string | undefined,
    to: string | undefined,
  ): Promise<InvestmentSummaryResponse> {
    const channel = CANAL_TO_CHANNEL[canal];
    const summaryData = await this.summary.getSummary({
      channel,
      from,
      to,
    });

    const picks: InvestmentSummaryPickRow[] = summaryData.picks.map((p) => ({
      fixtureId: p.fixtureId,
      fixture: p.fixture,
      homeLogo: p.homeLogo,
      awayLogo: p.awayLogo,
      competition: p.competition,
      scheduledAt: p.scheduledAt,
      canal: CHANNEL_TO_CANAL[p.channel],
      market: p.market,
      pick: p.pick,
      odds: p.odds,
      result: p.result,
    }));

    return {
      canal,
      stats: summaryData.stats,
      progression: summaryData.progression,
      picks,
      coupons: [],
    };
  }

  private async buildCouponSummary(
    from: string | undefined,
    to: string | undefined,
  ): Promise<InvestmentSummaryResponse> {
    const range = dateRange(from, to);
    const proposals = await this.repo.findResolvedCouponsInRange(
      range.from,
      range.to,
    );

    const coupons: InvestmentSummaryCouponRow[] = proposals
      .filter(
        (p) => p.result === 'WON' || p.result === 'LOST',
      )
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

    const stats: InvestmentSummaryStats = {
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
