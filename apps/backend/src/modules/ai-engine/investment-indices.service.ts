import { Injectable } from '@nestjs/common';
import { PredictionChannel } from '@evcore/db';
import { parseIsoDate, startOfUtcDay, endOfUtcDay } from '@utils/date.utils';
import { AiEngineRepository } from './ai-engine.repository';
import type { InvestmentIndicesCanal } from './dto/investment-indices-query.dto';
import type {
  InvestmentIndicesRow,
  InvestmentIndicesResponse,
} from './dto/investment-indices.dto';

// ─── Individual probability rows ─────────────────────────────────────────────

function buildRows(
  items: { prob: number; won: boolean }[],
): InvestmentIndicesRow[] {
  const map = new Map<number, { total: number; won: number }>();
  for (const item of items) {
    const pct = Math.round(item.prob * 100);
    const entry = map.get(pct) ?? { total: 0, won: 0 };
    entry.total += 1;
    if (item.won) entry.won += 1;
    map.set(pct, entry);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([pct, { total, won }]) => {
      const hitRate = total > 0 ? won / total : 0;
      return {
        probability: pct,
        total,
        won,
        hitRate,
        isGood: hitRate >= pct / 100,
      };
    });
}

function dateRange(
  from: string | undefined,
  to: string | undefined,
): { from: Date; to: Date; fromIso: string; toIso: string } {
  const today = new Date();
  const toDate = to
    ? endOfUtcDay(parseIsoDate(to))
    : endOfUtcDay(new Date(today.getTime() - 86_400_000));
  const fromDate = from
    ? startOfUtcDay(parseIsoDate(from))
    : startOfUtcDay(new Date(today.getTime() - 90 * 86_400_000));
  return {
    from: fromDate,
    to: toDate,
    fromIso: fromDate.toISOString().slice(0, 10),
    toIso: toDate.toISOString().slice(0, 10),
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class InvestmentIndicesService {
  constructor(private readonly repo: AiEngineRepository) {}

  async getIndices(query: {
    canal: InvestmentIndicesCanal;
    from?: string;
    to?: string;
  }): Promise<InvestmentIndicesResponse> {
    const { canal } = query;
    const range = dateRange(query.from, query.to);

    let items: { prob: number; won: boolean }[] = [];

    if (canal === 'EV' || canal === 'SV') {
      const bets = await this.repo.findSettledBetsForIndices(
        canal === 'SV',
        range.from,
        range.to,
      );
      items = bets.map((b) => ({
        prob: Number(b.probEstimated),
        won: b.status === 'WON',
      }));
    } else if (canal === 'BB') {
      const preds = await this.repo.findSettledPredictionsForIndices(
        PredictionChannel.BTTS,
        range.from,
        range.to,
      );
      items = preds
        .filter((p) => p.correct !== null)
        .map((p) => ({ prob: Number(p.probability), won: p.correct! }));
    } else if (canal === 'NUL') {
      const preds = await this.repo.findSettledPredictionsForIndices(
        PredictionChannel.DRAW,
        range.from,
        range.to,
      );
      items = preds
        .filter((p) => p.correct !== null)
        .map((p) => ({ prob: Number(p.probability), won: p.correct! }));
    } else if (canal === 'CONF') {
      const preds = await this.repo.findSettledPredictionsForIndices(
        PredictionChannel.CONF,
        range.from,
        range.to,
      );
      items = preds
        .filter((p) => p.correct !== null)
        .map((p) => ({ prob: Number(p.probability), won: p.correct! }));
    } else {
      // COUPON: uses joint probability
      const coupons = await this.repo.findResolvedCouponsForIndices(
        range.from,
        range.to,
      );
      items = coupons.map((c) => ({
        prob: Number(c.jointProbability),
        won: c.result === 'WON',
      }));
    }

    const rows = buildRows(items);
    const totalWon = items.filter((i) => i.won).length;

    return {
      canal,
      from: range.fromIso,
      to: range.toIso,
      rows,
      summary: {
        total: items.length,
        won: totalWon,
        hitRate: items.length > 0 ? totalWon / items.length : 0,
      },
    };
  }
}
