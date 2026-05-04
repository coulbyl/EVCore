import { Injectable } from '@nestjs/common';
import { PredictionChannel } from '@evcore/db';
import { parseIsoDate, startOfUtcDay, endOfUtcDay } from '@utils/date.utils';
import { toNumber } from '@utils/prisma.utils';
import { formatSigned } from '@modules/dashboard/dashboard.utils';
import { SummaryRepository } from './summary.repository';
import type {
  SummaryChannel,
  SummaryPeriod,
  SummaryPickRow,
  SummaryProgressionPoint,
  SummaryResponse,
  SummaryStats,
} from './summary.types';

function periodDateRange(
  period: SummaryPeriod | undefined,
  from: string | undefined,
  to: string | undefined,
): { from: Date; to: Date } {
  if (from && to) {
    return {
      from: startOfUtcDay(parseIsoDate(from)),
      to: endOfUtcDay(parseIsoDate(to)),
    };
  }
  const days = period === '30d' ? 30 : period === '3m' ? 90 : 7;
  const toDate = endOfUtcDay(new Date());
  const fromDate = startOfUtcDay(
    new Date(Date.now() - days * 24 * 60 * 60 * 1000),
  );
  return { from: fromDate, to: toDate };
}

function buildProgression(picks: SummaryPickRow[]): SummaryProgressionPoint[] {
  const sorted = [...picks].sort((a, b) =>
    a.scheduledAt.localeCompare(b.scheduledAt),
  );

  const byDate = new Map<string, { won: number; lost: number }>();
  for (const pick of sorted) {
    const date = pick.scheduledAt.slice(0, 10);
    const existing = byDate.get(date) ?? { won: 0, lost: 0 };
    if (pick.result === 'WON') existing.won += 1;
    else existing.lost += 1;
    byDate.set(date, existing);
  }

  const points: SummaryProgressionPoint[] = [];
  let cumWon = 0;
  let cumLost = 0;
  for (const [date, { won, lost }] of byDate) {
    cumWon += won;
    cumLost += lost;
    points.push({ date, won: cumWon, lost: cumLost });
  }
  return points;
}

@Injectable()
export class SummaryService {
  constructor(private readonly repo: SummaryRepository) {}

  async getSummary(query: {
    channel?: SummaryChannel;
    period?: SummaryPeriod;
    from?: string;
    to?: string;
  }): Promise<SummaryResponse> {
    const channel = query.channel ?? 'SV';
    const range = periodDateRange(query.period, query.from, query.to);
    const picks = await this.fetchPicks(channel, range);

    const won = picks.filter((p) => p.result === 'WON');
    const lost = picks.filter((p) => p.result === 'LOST');

    const stats: SummaryStats = {
      total: picks.length,
      won: won.length,
      lost: lost.length,
    };

    const sorted = [
      ...won.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
      ...lost.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
    ];

    return {
      channel,
      stats,
      progression: buildProgression(picks),
      picks: sorted,
    };
  }

  private async fetchPicks(
    channel: SummaryChannel,
    range: { from: Date; to: Date },
  ): Promise<SummaryPickRow[]> {
    if (channel === 'EV' || channel === 'SV') {
      const bets = await this.repo.findSettledBets(
        channel === 'SV',
        range.from,
        range.to,
      );
      return bets.map((bet) => ({
        fixtureId: bet.fixture.id,
        fixture: `${bet.fixture.homeTeam.name} vs ${bet.fixture.awayTeam.name}`,
        homeLogo: bet.fixture.homeTeam.logoUrl,
        awayLogo: bet.fixture.awayTeam.logoUrl,
        competition: bet.fixture.season.competition.name,
        competitionCode: bet.fixture.season.competition.code,
        scheduledAt: bet.fixture.scheduledAt.toISOString(),
        market: bet.market,
        pick: bet.pick,
        comboMarket: bet.comboMarket,
        comboPick: bet.comboPick,
        odds: bet.oddsSnapshot ? bet.oddsSnapshot.toString() : null,
        ev: `${formatSigned(toNumber(bet.ev) * 100, 1)}%`,
        result: bet.status === 'WON' ? 'WON' : 'LOST',
        channel,
      }));
    }

    const channelMap: Record<'CONF' | 'DRAW' | 'BTTS', PredictionChannel> = {
      CONF: PredictionChannel.CONF,
      DRAW: PredictionChannel.DRAW,
      BTTS: PredictionChannel.BTTS,
    };
    const predictions = await this.repo.findSettledPredictions(
      channelMap[channel],
      range.from,
      range.to,
    );
    return predictions.map((pred) => ({
      fixtureId: pred.fixture.id,
      fixture: `${pred.fixture.homeTeam.name} vs ${pred.fixture.awayTeam.name}`,
      homeLogo: pred.fixture.homeTeam.logoUrl,
      awayLogo: pred.fixture.awayTeam.logoUrl,
      competition: pred.fixture.season.competition.name,
      competitionCode: pred.fixture.season.competition.code,
      scheduledAt: pred.fixture.scheduledAt.toISOString(),
      market: pred.market,
      pick: pred.pick,
      comboMarket: null,
      comboPick: null,
      odds: null,
      ev: null,
      result: pred.correct ? 'WON' : 'LOST',
      channel,
    }));
  }
}
