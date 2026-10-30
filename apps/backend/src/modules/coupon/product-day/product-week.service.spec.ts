import { describe, expect, it, vi } from 'vitest';
import type {
  ProductDayRepository,
  ProductDayRow,
} from './product-day.repository';
import { ProductWeekService, WEEK_PRODUCTS } from './product-week.service';

function day(
  product: string,
  date: string,
  outcome: ProductDayRow['outcome'],
): ProductDayRow {
  return {
    product,
    forDate: new Date(`${date}T00:00:00.000Z`),
    couponProposalId: `${product}-${date}`,
    outcome,
    chance: null,
    paidOdds: null,
    priced: false,
    label: 'PSG – Lens',
    market: null,
    pick: null,
  };
}

function harness(rows: ProductDayRow[]) {
  const repository = {
    findDays: vi.fn().mockResolvedValue(rows),
  } as unknown as ProductDayRepository;
  return { service: new ProductWeekService(repository), repository };
}

describe('ProductWeekService', () => {
  it("reads Monday to Sunday, « Aujourd'hui »'s products only", async () => {
    const { service, repository } = harness([]);
    await service.getWeek('2026-10-19');
    expect(repository.findDays).toHaveBeenCalledWith({
      since: new Date('2026-10-19T00:00:00.000Z'),
      until: new Date('2026-10-26T00:00:00.000Z'),
      products: WEEK_PRODUCTS,
    });
    expect(WEEK_PRODUCTS).not.toContain('COMBO_AI');
    expect(WEEK_PRODUCTS).not.toContain('LONG');
  });

  it('counts won over played: a refund is neither, a pending day waits', async () => {
    const { service } = harness([
      day('FAVOURITE', '2026-10-19', 'won'),
      day('FAVOURITE', '2026-10-20', 'refunded'),
      day('FAVOURITE', '2026-10-21', 'lost'),
      day('FAVOURITE', '2026-10-25', 'pending'),
      day('COMBO', '2026-10-19', 'won'),
    ]);
    const week = await service.getWeek('2026-10-19');
    expect(week.products).toEqual([
      { product: 'FAVOURITE', won: 1, played: 2 },
      { product: 'COMBO', won: 1, played: 1 },
    ]);
    expect(week.days).toHaveLength(7);
    expect(week.days[0]).toEqual({
      date: '2026-10-19',
      marks: [
        { product: 'FAVOURITE', outcome: 'won' },
        { product: 'COMBO', outcome: 'won' },
      ],
    });
    expect(week.days[6]).toEqual({
      date: '2026-10-25',
      marks: [{ product: 'FAVOURITE', outcome: 'pending' }],
    });
  });
});
