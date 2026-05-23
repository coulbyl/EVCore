import { Injectable } from '@nestjs/common';
import { PredictionChannel } from '@evcore/db';
import { parseIsoDate, startOfUtcDay, endOfUtcDay } from '@utils/date.utils';
import { AiEngineRepository } from './ai-engine.repository';
import type { InvestmentIndicesCanal } from './dto/investment-indices-query.dto';
import type {
  InvestmentIndicesBucket,
  InvestmentIndicesResponse,
} from './dto/investment-indices.dto';

// ─── Probability buckets ─────────────────────────────────────────────────────

type Bucket = { label: string; min: number; max: number };

const BUCKETS: Bucket[] = [
  { label: '0–10%', min: 0.0, max: 0.1 },
  { label: '10–20%', min: 0.1, max: 0.2 },
  { label: '20–30%', min: 0.2, max: 0.3 },
  { label: '30–40%', min: 0.3, max: 0.4 },
  { label: '40–50%', min: 0.4, max: 0.5 },
  { label: '50–55%', min: 0.5, max: 0.55 },
  { label: '55–60%', min: 0.55, max: 0.6 },
  { label: '60–65%', min: 0.6, max: 0.65 },
  { label: '65–70%', min: 0.65, max: 0.7 },
  { label: '70–75%', min: 0.7, max: 0.75 },
  { label: '75–80%', min: 0.75, max: 0.8 },
  { label: '80%+', min: 0.8, max: 1.01 },
];

function assignBucket(prob: number): Bucket | null {
  return BUCKETS.find((b) => prob >= b.min && prob < b.max) ?? null;
}

function buildBuckets(
  items: { prob: number; won: boolean }[],
): InvestmentIndicesBucket[] {
  const map = new Map<string, { total: number; won: number; b: Bucket }>();
  for (const item of items) {
    const b = assignBucket(item.prob);
    if (!b) continue;
    const entry = map.get(b.label) ?? { total: 0, won: 0, b };
    entry.total += 1;
    if (item.won) entry.won += 1;
    map.set(b.label, entry);
  }
  return BUCKETS.filter((b) => map.has(b.label)).map((b) => {
    const { total, won } = map.get(b.label)!;
    const hitRate = total > 0 ? won / total : 0;
    const midpoint = (b.min + Math.min(b.max, 1.0)) / 2;
    return {
      label: b.label,
      min: b.min,
      max: b.max,
      total,
      won,
      hitRate,
      isGood: hitRate >= midpoint,
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

    const buckets = buildBuckets(items);
    const totalWon = items.filter((i) => i.won).length;

    return {
      canal,
      from: range.fromIso,
      to: range.toIso,
      buckets,
      summary: {
        total: items.length,
        won: totalWon,
        hitRate: items.length > 0 ? totalWon / items.length : 0,
      },
    };
  }
}
