import { describe, expect, it } from 'vitest';
import { BetStatus, Prisma, StrategyChannel } from '@evcore/db';
import { CouponRoiService } from './coupon-roi.service';
import type { CouponRepository } from './coupon.repository';

type Row = {
  channel: StrategyChannel;
  ev: Prisma.Decimal | null;
  odds: Prisma.Decimal | null;
  result: BetStatus;
};

function stubRepo(rows: Row[]): CouponRepository {
  return {
    findSettledChannelSelections: () => Promise.resolve(rows),
  } as unknown as CouponRepository;
}

const dec = (v: string) => new Prisma.Decimal(v);

describe('CouponRoiService.getRoiByChannel', () => {
  it('buckets EV-bearing channels by EV bin and computes flat ROI', async () => {
    const rows: Row[] = [
      // VALUE @ EV 0.10 → '8–15%' bin. 2 won (odds 2.0), 1 lost.
      {
        channel: StrategyChannel.VALUE,
        ev: dec('0.10'),
        odds: dec('2.0'),
        result: BetStatus.WON,
      },
      {
        channel: StrategyChannel.VALUE,
        ev: dec('0.10'),
        odds: dec('2.0'),
        result: BetStatus.WON,
      },
      {
        channel: StrategyChannel.VALUE,
        ev: dec('0.10'),
        odds: dec('2.0'),
        result: BetStatus.LOST,
      },
    ];
    const service = new CouponRoiService(stubRepo(rows));

    const res = await service.getRoiByChannel({});
    const value = res.channels.find((c) => c.channel === StrategyChannel.VALUE);
    expect(value).toBeDefined();
    expect(value!.total).toBe(3);
    expect(value!.won).toBe(2);
    expect(value!.roi).toBeCloseTo((1 + 1 - 1) / 3, 10);

    const bin = value!.bins.find((b) => b.label === '8–15%');
    expect(bin).toBeDefined();
    expect(bin!.total).toBe(3);
    expect(bin!.roi).toBeCloseTo(1 / 3, 10);
    expect(bin!.promote).toBe(false); // below MIN_BET_COUNT sample
  });

  it('routes null-EV channels (e.g. DRAW) into the n/a bin', async () => {
    const rows: Row[] = [
      {
        channel: StrategyChannel.DRAW,
        ev: null,
        odds: dec('3.0'),
        result: BetStatus.WON,
      },
      {
        channel: StrategyChannel.DRAW,
        ev: null,
        odds: dec('3.0'),
        result: BetStatus.LOST,
      },
    ];
    const service = new CouponRoiService(stubRepo(rows));

    const res = await service.getRoiByChannel({});
    const draw = res.channels.find((c) => c.channel === StrategyChannel.DRAW);
    expect(draw).toBeDefined();
    expect(draw!.bins).toHaveLength(1);
    expect(draw!.bins[0].label).toBe('n/a');
    expect(draw!.bins[0].roi).toBeCloseTo((3 - 1 - 1) / 2, 10); // 0.5
  });

  it('exposes the minimum promotion sample and an empty result when no data', async () => {
    const service = new CouponRoiService(stubRepo([]));
    const res = await service.getRoiByChannel({});
    expect(res.channels).toHaveLength(0);
    expect(res.minPromotionSample).toBeGreaterThan(0);
  });
});
