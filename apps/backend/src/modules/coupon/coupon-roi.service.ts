import { Injectable } from '@nestjs/common';
import { BetStatus, StrategyChannel } from '@evcore/db';
import { MIN_BET_COUNT } from '@modules/adjustment/adjustment.constants';
import { parseIsoDate, startOfUtcDay, endOfUtcDay } from '@utils/date.utils';
import { CouponRepository } from './coupon.repository';
import type {
  CouponRoiBinRow,
  CouponRoiChannelRow,
  CouponRoiResponse,
} from './dto/coupon-roi.dto';

type SettledSelection = {
  channel: StrategyChannel;
  ev: number | null;
  odds: number;
  won: boolean;
};

// EV-bin edges (DESIGN.md — promotion tool). A bin holds selections whose EV is in
// [from, to). The no-EV bucket ('n/a') collects channels priced on implied
// probability (e.g. DRAW), whose `ev` is null by design.
const EV_BINS: { label: string; from: number; to: number }[] = [
  { label: '< 0%', from: -Infinity, to: 0 },
  { label: '0–4%', from: 0, to: 0.04 },
  { label: '4–8%', from: 0.04, to: 0.08 },
  { label: '8–15%', from: 0.08, to: 0.15 },
  { label: '≥ 15%', from: 0.15, to: Infinity },
];

function flatRoi(items: { won: boolean; odds: number }[]): number {
  if (items.length === 0) return 0;
  return (
    items.reduce((acc, i) => acc + (i.won ? i.odds - 1 : -1), 0) / items.length
  );
}

function clampBound(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function buildBins(rows: SettledSelection[]): CouponRoiBinRow[] {
  const bins: CouponRoiBinRow[] = [];

  for (const bin of EV_BINS) {
    const group = rows.filter(
      (r) => r.ev !== null && r.ev >= bin.from && r.ev < bin.to,
    );
    if (group.length === 0) continue;
    const won = group.filter((r) => r.won).length;
    const roi = flatRoi(group);
    bins.push({
      label: bin.label,
      from: clampBound(bin.from),
      to: clampBound(bin.to),
      total: group.length,
      won,
      hitRate: won / group.length,
      roi,
      promote: roi > 0 && group.length >= MIN_BET_COUNT,
    });
  }

  const noEv = rows.filter((r) => r.ev === null);
  if (noEv.length > 0) {
    const won = noEv.filter((r) => r.won).length;
    const roi = flatRoi(noEv);
    bins.push({
      label: 'n/a',
      from: null,
      to: null,
      total: noEv.length,
      won,
      hitRate: won / noEv.length,
      roi,
      promote: roi > 0 && noEv.length >= MIN_BET_COUNT,
    });
  }

  return bins;
}

function dateRange(
  from: string | undefined,
  to: string | undefined,
): {
  from: Date;
  to: Date;
  fromIso: string;
  toIso: string;
} {
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

@Injectable()
export class CouponRoiService {
  constructor(private readonly repo: CouponRepository) {}

  /**
   * Rolling flat-stake ROI per channel × EV-bin over a date window — the channel
   * promotion tool. Reads settled `channel_selection` for every channel (incl.
   * DRAW/BTTS/DOMINANT), independent of any materialised `Bet`.
   */
  async getRoiByChannel(query: {
    from?: string;
    to?: string;
  }): Promise<CouponRoiResponse> {
    const range = dateRange(query.from, query.to);
    const settled = await this.repo.findSettledChannelSelections({
      from: range.from,
      to: range.to,
    });

    const rows: SettledSelection[] = settled
      .filter(
        (s): s is typeof s & { odds: NonNullable<typeof s.odds> } =>
          s.odds !== null,
      )
      .map((s) => ({
        channel: s.channel,
        ev: s.ev !== null ? Number(s.ev) : null,
        odds: Number(s.odds),
        won: s.result === BetStatus.WON,
      }));

    const byChannel = new Map<StrategyChannel, SettledSelection[]>();
    for (const row of rows) {
      const list = byChannel.get(row.channel) ?? [];
      list.push(row);
      byChannel.set(row.channel, list);
    }

    const channels: CouponRoiChannelRow[] = [...byChannel.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([channel, group]) => {
        const won = group.filter((r) => r.won).length;
        return {
          channel,
          total: group.length,
          won,
          hitRate: group.length > 0 ? won / group.length : 0,
          roi: flatRoi(group),
          bins: buildBins(group),
        };
      });

    return {
      from: range.fromIso,
      to: range.toIso,
      minPromotionSample: MIN_BET_COUNT,
      channels,
    };
  }
}
