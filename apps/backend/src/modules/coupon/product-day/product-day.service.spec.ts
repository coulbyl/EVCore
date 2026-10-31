import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@evcore/db';
import { RESULTS_PRODUCTS } from '@config/results.constants';
import type {
  ProductDayRepository,
  ProductLegRow,
} from './product-day.repository';
import { ProductDayService } from './product-day.service';

const d = (value: string) => new Prisma.Decimal(value);

function leg(overrides: Partial<ProductLegRow>): ProductLegRow {
  return {
    couponId: 'combo',
    source: 'ENGINE',
    targetOddsMin: d('1.20'),
    forDate: new Date('2026-10-28T00:00:00.000Z'),
    result: 'WON',
    market: 'ONE_X_TWO',
    pick: 'HOME',
    operatorOdds: d('1.200'),
    oddsSnapshot: d('1.250'),
    probability: d('0.8000'),
    operatorFairProbability: d('0.7700'),
    isCorrect: true,
    settledAt: new Date('2026-10-28T22:00:00.000Z'),
    scheduledAt: new Date('2026-10-28T19:00:00.000Z'),
    homeName: 'PSG',
    awayName: 'Lens',
    ...overrides,
  };
}

function harness(rows: ProductLegRow[]) {
  const repository = {
    findProductLegs: vi.fn().mockResolvedValue(rows),
    upsertDays: vi.fn().mockResolvedValue(rows.length),
  } as unknown as ProductDayRepository;
  return { service: new ProductDayService(repository), repository };
}

describe('ProductDayService', () => {
  it('rewrites the last seven days, up to tomorrow, for every product', async () => {
    const { service, repository } = harness([]);
    await service.refreshRecent(new Date('2026-10-30T15:00:00.000Z'));
    expect(repository.findProductLegs).toHaveBeenCalledWith({
      since: new Date('2026-10-23T00:00:00.000Z'),
      until: new Date('2026-10-31T00:00:00.000Z'),
      products: RESULTS_PRODUCTS,
    });
  });

  it('writes one day per coupon, in decimal.js', async () => {
    const { service, repository } = harness([
      leg({}),
      leg({ operatorOdds: d('1.150'), probability: d('0.9000') }),
      // A refunded leg: pays 1, and the day stays priced.
      leg({ isCorrect: null, operatorOdds: d('1.400') }),
    ]);
    await service.refresh({
      from: new Date('2026-10-28T00:00:00.000Z'),
      to: new Date('2026-10-28T00:00:00.000Z'),
    });
    const [days] = vi.mocked(repository.upsertDays).mock.calls[0] ?? [];
    expect(days).toEqual([
      {
        product: 'COMBO',
        forDate: new Date('2026-10-28T00:00:00.000Z'),
        couponProposalId: 'combo',
        outcome: 'won',
        // 0,80 × 0,90 × 0,80.
        chance: d('0.576'),
        // 1,20 × 1,15 = 1,38, the refunded leg left out.
        paidOdds: d('1.38'),
        priced: true,
        label: '3 matchs',
        market: null,
        pick: null,
      },
    ]);
  });

  it('a coupon of no known product is not a product day', async () => {
    const { service, repository } = harness([
      leg({ source: 'ENGINE', targetOddsMin: d('9.99') }),
    ]);
    await service.refresh({ from: new Date(), to: new Date() });
    expect(vi.mocked(repository.upsertDays).mock.calls[0]?.[0]).toEqual([]);
  });

  it('a correction after the fact rewrites the day, a replay writes it the same', async () => {
    const day = { from: new Date('2026-10-28'), to: new Date('2026-10-28') };
    // Settled won, then the score corrected (VAR, a late fix): lost.
    const won = harness([leg({})]);
    await won.service.refresh(day);
    await won.service.refresh(day);
    const lost = harness([leg({ result: 'LOST', isCorrect: false })]);
    await lost.service.refresh(day);

    const written = (h: ReturnType<typeof harness>, call: number) =>
      vi.mocked(h.repository.upsertDays).mock.calls[call]?.[0];
    // A second pass on the same rows writes exactly the same day: upserted
    // by (product, day), nothing adds up.
    expect(written(won, 1)).toEqual(written(won, 0));
    expect(written(won, 0)?.[0]?.outcome).toBe('won');
    expect(written(lost, 0)?.[0]).toMatchObject({
      outcome: 'lost',
      paidOdds: null,
    });
  });
});
