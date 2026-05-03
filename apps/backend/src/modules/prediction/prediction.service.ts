import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { startOfUtcDay, endOfUtcDay, formatTimeUtc } from '@utils/date.utils';
import { Market, PredictionChannel } from '@evcore/db';
import {
  getPredictionConfig,
  PREDICTION_CHANNELS,
} from './prediction.constants';
import { PredictionRepository } from './prediction.repository';
import type { ThreeWayProba } from '@modules/betting-engine/betting-engine.utils';

type PredictionWithFixture = Awaited<
  ReturnType<PredictionRepository['findByDate']>
>[number];

export type PredictionListItem = {
  id: string;
  fixtureId: string;
  competition: string;
  channel: PredictionChannel;
  fixture: string;
  kickoff: string;
  market: string;
  pick: string;
  probability: string;
  correct: boolean | null;
  settledAt: string | null;
  createdAt: string;
};

export type PredictionStats = {
  total: number;
  correct: number;
  hitRate: string;
  byCompetition: {
    competition: string;
    total: number;
    correct: number;
    hitRate: string;
  }[];
};

@Injectable()
export class PredictionService {
  constructor(private readonly repo: PredictionRepository) {}

  async createPredictions(opts: {
    fixtureId: string;
    modelRunId: string;
    competition: string;
    probabilities: ThreeWayProba & { bttsYes: Decimal };
  }): Promise<void> {
    const { fixtureId, modelRunId, competition, probabilities } = opts;

    for (const channel of PREDICTION_CHANNELS) {
      const config = getPredictionConfig(channel, competition);
      const candidate = buildPredictionCandidate(channel, probabilities);

      if (!config.enabled || candidate.probability.lt(config.threshold)) {
        await this.repo.deleteForFixtureChannel(fixtureId, channel);
        continue;
      }

      await this.repo.upsert({
        fixtureId,
        modelRunId,
        competition,
        channel,
        market: candidate.market,
        pick: candidate.pick,
        probability: new Decimal(candidate.probability.toFixed(4)),
      });
    }
  }

  async settlePredictions(
    fixtureId: string,
    homeScore: number | null,
    awayScore: number | null,
  ): Promise<{ settled: number }> {
    if (homeScore === null || awayScore === null) return { settled: 0 };

    const predictions = await this.repo.findPendingForFixture(fixtureId);
    if (predictions.length === 0) return { settled: 0 };

    for (const prediction of predictions) {
      const actualPick = resolveActualPick(
        prediction.market,
        homeScore,
        awayScore,
      );
      await this.repo.settleById(prediction.id, prediction.pick === actualPick);
    }

    return { settled: predictions.length };
  }

  async list(
    date: string,
    competition?: string,
    channel?: PredictionChannel,
  ): Promise<PredictionListItem[]> {
    const day = new Date(date);
    const rows = await this.repo.findByDate(
      { gte: startOfUtcDay(day), lte: endOfUtcDay(day) },
      competition,
      channel,
    );
    return rows.map((r) => this.toListItem(r));
  }

  async stats(input: {
    from: string;
    to: string;
    competition?: string;
    channel?: PredictionChannel;
  }): Promise<PredictionStats> {
    const rows = await this.repo.findForStats({
      from: new Date(input.from),
      to: new Date(input.to),
      competition: input.competition,
      channel: input.channel,
    });

    const total = rows.length;
    const correct = rows.filter((r) => r.correct === true).length;
    const hitRate =
      total > 0 ? `${((correct / total) * 100).toFixed(1)}%` : '—';

    const byComp = new Map<string, { total: number; correct: number }>();
    for (const row of rows) {
      const agg = byComp.get(row.competition) ?? { total: 0, correct: 0 };
      agg.total++;
      if (row.correct) agg.correct++;
      byComp.set(row.competition, agg);
    }

    return {
      total,
      correct,
      hitRate,
      byCompetition: Array.from(byComp.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([comp, agg]) => ({
          competition: comp,
          total: agg.total,
          correct: agg.correct,
          hitRate:
            agg.total > 0
              ? `${((agg.correct / agg.total) * 100).toFixed(1)}%`
              : '—',
        })),
    };
  }

  private toListItem(r: PredictionWithFixture): PredictionListItem {
    return {
      id: r.id,
      fixtureId: r.fixtureId,
      competition: r.competition,
      channel: r.channel,
      fixture: `${r.fixture.homeTeam.name} vs ${r.fixture.awayTeam.name}`,
      kickoff: formatTimeUtc(r.fixture.scheduledAt),
      market: r.market,
      pick: r.pick,
      probability: `${(Number(r.probability) * 100).toFixed(0)}%`,
      correct: r.correct,
      settledAt: r.settledAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}

export type ChannelPredictionCandidate = {
  market: Market;
  pick: string;
  probability: Decimal;
};

export function buildPredictionCandidate(
  channel: PredictionChannel,
  probabilities: ThreeWayProba & { bttsYes: Decimal },
): ChannelPredictionCandidate {
  if (channel === PredictionChannel.DRAW) {
    return {
      market: Market.ONE_X_TWO,
      pick: 'DRAW',
      probability: probabilities.draw,
    };
  }

  if (channel === PredictionChannel.BTTS) {
    return {
      market: Market.BTTS,
      pick: 'YES',
      probability: probabilities.bttsYes,
    };
  }

  const pHome = probabilities.home;
  const pDraw = probabilities.draw;
  const pAway = probabilities.away;
  const pMax = Decimal.max(pHome, pDraw, pAway);

  return {
    market: Market.ONE_X_TWO,
    pick:
      pHome.gte(pDraw) && pHome.gte(pAway)
        ? 'HOME'
        : pDraw.gte(pAway)
          ? 'DRAW'
          : 'AWAY',
    probability: pMax,
  };
}

export function resolveActualPick(
  market: Market,
  homeScore: number,
  awayScore: number,
): string {
  if (market === Market.BTTS) {
    return homeScore > 0 && awayScore > 0 ? 'YES' : 'NO';
  }

  return homeScore > awayScore
    ? 'HOME'
    : homeScore < awayScore
      ? 'AWAY'
      : 'DRAW';
}
