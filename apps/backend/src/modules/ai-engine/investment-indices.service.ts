import { Injectable } from '@nestjs/common';
import { Market, PredictionChannel } from '@evcore/db';
import { parseIsoDate, startOfUtcDay, endOfUtcDay } from '@utils/date.utils';
import { AiEngineRepository } from './ai-engine.repository';
import type { InvestmentIndicesCanal } from './dto/investment-indices-query.dto';
import type {
  InvestmentIndicesRow,
  InvestmentIndicesMarketRow,
  InvestmentIndicesOddsRow,
  InvestmentIndicesResponse,
} from './dto/investment-indices.dto';

// ─── Internal types ───────────────────────────────────────────────────────────

type IndicesItem = {
  prob: number;
  won: boolean;
  market: string;
  odds: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ODDS_RANGES: { label: string; from: number; to: number }[] = [
  { label: '1.10 – 1.30', from: 1.1, to: 1.3 },
  { label: '1.30 – 1.60', from: 1.3, to: 1.6 },
  { label: '1.60 – 2.00', from: 1.6, to: 2.0 },
  { label: '2.00 +', from: 2.0, to: 999 },
];

const MARKET_LABEL: Record<string, string> = {
  ONE_X_TWO: '1X2',
  OVER_UNDER: 'Over/Under',
  BTTS: 'BTTS',
  DOUBLE_CHANCE: 'Double chance',
  HALF_TIME_FULL_TIME: 'Mi-temps / Match',
  OVER_UNDER_HT: 'Over/Under MT',
  FIRST_HALF_WINNER: '1re mi-temps',
};

// ─── Builders ─────────────────────────────────────────────────────────────────

function computeRoi(
  items: { won: boolean; odds: number | null }[],
): number | null {
  const withOdds = items.filter(
    (i): i is { won: boolean; odds: number } => i.odds !== null,
  );
  if (withOdds.length === 0) return null;
  return (
    withOdds.reduce((acc, i) => acc + (i.won ? i.odds - 1 : -1), 0) /
    withOdds.length
  );
}

function buildCalibrationRows(items: IndicesItem[]): InvestmentIndicesRow[] {
  const map = new Map<number, { total: number; won: number }>();
  for (const item of items) {
    const pct = Math.round(item.prob * 1000) / 10;
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

function buildByMarket(items: IndicesItem[]): InvestmentIndicesMarketRow[] {
  const groups = new Map<string, IndicesItem[]>();
  for (const item of items) {
    const list = groups.get(item.market) ?? [];
    list.push(item);
    groups.set(item.market, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([market, group]) => {
      const won = group.filter((i) => i.won).length;
      return {
        market,
        label: MARKET_LABEL[market] ?? market,
        total: group.length,
        won,
        hitRate: group.length > 0 ? won / group.length : 0,
        roi: computeRoi(group),
      };
    });
}

function buildByOddsRange(
  items: IndicesItem[],
): InvestmentIndicesOddsRow[] | null {
  const withOdds = items.filter(
    (i): i is IndicesItem & { odds: number } => i.odds !== null,
  );
  if (withOdds.length === 0) return null;

  const rows: InvestmentIndicesOddsRow[] = [];
  for (const range of ODDS_RANGES) {
    const group = withOdds.filter(
      (i) => i.odds >= range.from && i.odds < range.to,
    );
    if (group.length === 0) continue;
    const won = group.filter((i) => i.won).length;
    const roi =
      group.reduce((acc, i) => acc + (i.won ? i.odds - 1 : -1), 0) /
      group.length;
    rows.push({
      label: range.label,
      from: range.from,
      to: range.to,
      total: group.length,
      won,
      hitRate: won / group.length,
      roi,
    });
  }
  return rows.length > 0 ? rows : null;
}

function extractOdds(p: {
  pick: string;
  fixture: {
    oddsSnapshots: {
      homeOdds: unknown;
      drawOdds: unknown;
      awayOdds: unknown;
      pick: string | null;
      odds: unknown;
    }[];
  };
}): number | null {
  const snap = p.fixture.oddsSnapshots[0];
  if (!snap) return null;
  if (snap.odds !== null && snap.odds !== undefined) return Number(snap.odds);
  if (
    p.pick === 'HOME' &&
    snap.homeOdds !== null &&
    snap.homeOdds !== undefined
  )
    return Number(snap.homeOdds);
  if (
    p.pick === 'DRAW' &&
    snap.drawOdds !== null &&
    snap.drawOdds !== undefined
  )
    return Number(snap.drawOdds);
  if (
    p.pick === 'AWAY' &&
    snap.awayOdds !== null &&
    snap.awayOdds !== undefined
  )
    return Number(snap.awayOdds);
  return null;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

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

    let items: IndicesItem[] = [];

    if (canal === 'EV' || canal === 'SV') {
      const bets = await this.repo.findSettledBetsForIndices(
        canal === 'SV',
        range.from,
        range.to,
      );
      items = bets.map((b) => ({
        prob: Number(b.probEstimated),
        won: b.status === 'WON',
        market: b.market,
        odds: b.oddsSnapshot !== null ? Number(b.oddsSnapshot) : null,
      }));
    } else if (canal === 'BB') {
      const preds = await this.repo.findSettledPredictionsForIndices({
        channel: PredictionChannel.BTTS,
        oddsMarket: Market.BTTS,
        from: range.from,
        to: range.to,
      });
      items = preds
        .filter((p) => p.correct !== null)
        .map((p) => ({
          prob: Number(p.probability),
          won: p.correct!,
          market: p.market,
          odds: extractOdds(p),
        }));
    } else if (canal === 'NUL') {
      const preds = await this.repo.findSettledPredictionsForIndices({
        channel: PredictionChannel.DRAW,
        oddsMarket: Market.ONE_X_TWO,
        from: range.from,
        to: range.to,
      });
      items = preds
        .filter((p) => p.correct !== null)
        .map((p) => ({
          prob: Number(p.probability),
          won: p.correct!,
          market: p.market,
          odds: extractOdds(p),
        }));
    } else if (canal === 'CONF') {
      const preds = await this.repo.findSettledPredictionsForIndices({
        channel: PredictionChannel.CONF,
        oddsMarket: Market.ONE_X_TWO,
        from: range.from,
        to: range.to,
      });
      items = preds
        .filter((p) => p.correct !== null)
        .map((p) => ({
          prob: Number(p.probability),
          won: p.correct!,
          market: p.market,
          odds: extractOdds(p),
        }));
    } else {
      // COUPON: uses joint probability + combined odds
      const coupons = await this.repo.findResolvedCouponsForIndices(
        range.from,
        range.to,
      );
      items = coupons.map((c) => ({
        prob: Number(c.jointProbability),
        won: c.result === 'WON',
        market: 'COUPON',
        odds: Number(c.combinedOdds),
      }));
    }

    const totalWon = items.filter((i) => i.won).length;

    return {
      canal,
      from: range.fromIso,
      to: range.toIso,
      rows: buildCalibrationRows(items),
      summary: {
        total: items.length,
        won: totalWon,
        hitRate: items.length > 0 ? totalWon / items.length : 0,
        roi: computeRoi(items),
      },
      byMarket: canal !== 'COUPON' ? buildByMarket(items) : [],
      byOddsRange: buildByOddsRange(items),
    };
  }
}
