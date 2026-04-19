import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { startOfUtcDay, endOfUtcDay } from '@utils/date.utils';
import { getPredictionConfig } from './prediction.constants';
import { PredictionRepository } from './prediction.repository';
import type { PredictionRow } from './prediction.repository';
import type { ThreeWayProba } from '@modules/betting-engine/betting-engine.utils';

export type PredictionListItem = {
  id: string;
  fixtureId: string;
  competition: string;
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

  async createPrediction(opts: {
    fixtureId: string;
    modelRunId: string;
    competition: string;
    probabilities: ThreeWayProba;
  }): Promise<void> {
    const { fixtureId, modelRunId, competition, probabilities } = opts;

    const config = getPredictionConfig(competition);
    if (!config.enabled) return;

    const pHome = probabilities.home;
    const pDraw = probabilities.draw;
    const pAway = probabilities.away;

    const pMax = Decimal.max(pHome, pDraw, pAway);
    if (pMax.lt(config.threshold)) return;

    const pick =
      pHome.gte(pDraw) && pHome.gte(pAway)
        ? 'HOME'
        : pDraw.gte(pAway)
          ? 'DRAW'
          : 'AWAY';

    await this.repo.upsert({
      fixtureId,
      modelRunId,
      competition,
      pick,
      probability: new Decimal(pMax.toFixed(4)),
    });
  }

  async settlePredictions(
    fixtureId: string,
    homeScore: number | null,
    awayScore: number | null,
  ): Promise<{ settled: number }> {
    if (homeScore === null || awayScore === null) return { settled: 0 };

    const actual =
      homeScore > awayScore ? 'HOME' : homeScore < awayScore ? 'AWAY' : 'DRAW';

    const prediction = await this.repo.findForFixture(fixtureId);
    if (!prediction || prediction.correct !== null) return { settled: 0 };

    const correct = prediction.pick === actual;
    const count = await this.repo.settlePending(fixtureId, correct);
    return { settled: count };
  }

  async list(
    date: string,
    competition?: string,
  ): Promise<PredictionListItem[]> {
    const day = new Date(date);
    const rows = await this.repo.findByDate(
      { gte: startOfUtcDay(day), lte: endOfUtcDay(day) },
      competition,
    );
    return rows.map((r) => this.toListItem(r));
  }

  async stats(
    from: string,
    to: string,
    competition?: string,
  ): Promise<PredictionStats> {
    const rows = await this.repo.findForStats(
      new Date(from),
      new Date(to),
      competition,
    );

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

  private toListItem(r: PredictionRow): PredictionListItem {
    return {
      id: r.id,
      fixtureId: r.fixtureId,
      competition: r.competition,
      market: r.market,
      pick: r.pick,
      probability: `${(Number(r.probability) * 100).toFixed(1)}%`,
      correct: r.correct,
      settledAt: r.settledAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
