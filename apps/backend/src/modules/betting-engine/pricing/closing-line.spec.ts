import { describe, expect, it } from 'vitest';
import { Market } from '@evcore/db';
import {
  readQuotedBookmaker,
  resolveClosingLine,
  type ClosingLineRow,
} from './closing-line';

function row(bookmaker: string, pick: string, odds: number): ClosingLineRow {
  return {
    fixtureId: 'f1',
    bookmaker,
    market: Market.ONE_X_TWO,
    pick,
    line: null,
    odds,
    observedAt: new Date('2026-10-04T17:48:00.000Z'),
  };
}

function totalRow(pick: string, odds: number): ClosingLineRow {
  return { ...row('Pinnacle', pick, odds), market: Market.OVER_UNDER };
}

describe('resolveClosingLine', () => {
  const pinnacle = [
    row('Pinnacle', 'HOME', 1.9),
    row('Pinnacle', 'DRAW', 3.6),
    {
      ...row('Pinnacle', 'AWAY', 4.2),
      observedAt: new Date('2026-10-04T17:06:00.000Z'),
    },
  ];
  const unibet = [
    row('Unibet', 'HOME', 2.0),
    row('Unibet', 'DRAW', 3.5),
    row('Unibet', 'AWAY', 4.0),
  ];

  it('retire la marge du groupe complet du book le mieux classé', () => {
    const result = resolveClosingLine({
      market: Market.ONE_X_TWO,
      pick: 'HOME',
      takenOdds: 2.1,
      preferredBookmaker: null,
      rows: [...unibet, ...pinnacle],
    });
    const overround = 1 / 1.9 + 1 / 3.6 + 1 / 4.2;
    expect(result?.closingBookmaker).toBe('Pinnacle');
    expect(result?.closingOdds).toBe(1.9);
    expect(result?.closingLineValue).toBeCloseTo(
      2.1 * (1 / 1.9 / overround) - 1,
      10,
    );
    // L'observation la moins fraîche du groupe fait foi.
    expect(result?.closingObservedAt.toISOString()).toBe(
      '2026-10-04T17:06:00.000Z',
    );
  });

  it('préfère le book qui a servi le prix de la jambe quand il est complet', () => {
    const result = resolveClosingLine({
      market: Market.ONE_X_TWO,
      pick: 'HOME',
      takenOdds: 2.1,
      preferredBookmaker: 'Unibet',
      rows: [...pinnacle, ...unibet],
    });
    expect(result?.closingBookmaker).toBe('Unibet');
    expect(result?.closingOdds).toBe(2.0);
  });

  it('ignore un book dont le groupe est incomplet, même préféré', () => {
    const result = resolveClosingLine({
      market: Market.ONE_X_TWO,
      pick: 'HOME',
      takenOdds: 2.1,
      preferredBookmaker: 'Bet365',
      rows: [row('Bet365', 'HOME', 1.8), ...pinnacle],
    });
    expect(result?.closingBookmaker).toBe('Pinnacle');
  });

  it('rend null sans groupe complet ou sur un marché sans partition', () => {
    expect(
      resolveClosingLine({
        market: Market.ONE_X_TWO,
        pick: 'HOME',
        takenOdds: 2.1,
        preferredBookmaker: null,
        rows: [row('Pinnacle', 'HOME', 1.9), row('Pinnacle', 'DRAW', 3.6)],
      }),
    ).toBeNull();
    expect(
      resolveClosingLine({
        market: Market.TO_WIN_EITHER_HALF,
        pick: 'HOME',
        takenOdds: 1.5,
        preferredBookmaker: null,
        rows: [
          {
            ...row('Pinnacle', 'HOME', 1.4),
            market: Market.TO_WIN_EITHER_HALF,
          },
          {
            ...row('Pinnacle', 'AWAY', 2.8),
            market: Market.TO_WIN_EITHER_HALF,
          },
        ],
      }),
    ).toBeNull();
  });

  it('apparie une ligne de total avec sa seule opposée', () => {
    const result = resolveClosingLine({
      market: Market.OVER_UNDER,
      pick: 'OVER_1_5',
      takenOdds: 1.3,
      preferredBookmaker: null,
      rows: [
        totalRow('OVER_1_5', 1.25),
        totalRow('UNDER_1_5', 3.9),
        totalRow('OVER', 1.8),
        totalRow('UNDER', 2.0),
      ],
    });
    const overround = 1 / 1.25 + 1 / 3.9;
    expect(result?.closingOdds).toBe(1.25);
    expect(result?.closingLineValue).toBeCloseTo(
      1.3 * (1 / 1.25 / overround) - 1,
      10,
    );
  });
});

describe('resolveClosingLine on corners', () => {
  const corner = (
    pick: string,
    line: number,
    odds: number,
  ): ClosingLineRow => ({
    ...row('Pinnacle', pick, odds),
    market: Market.CORNERS,
    line,
  });

  it('reads the corner close at the leg line only', () => {
    const result = resolveClosingLine({
      market: Market.CORNERS,
      pick: 'UNDER',
      line: 9.5,
      takenOdds: 1.88,
      preferredBookmaker: null,
      rows: [
        corner('OVER', 9.5, 1.9),
        corner('UNDER', 9.5, 1.95),
        corner('OVER', 10.5, 2.3),
        corner('UNDER', 10.5, 1.6),
      ],
    });
    const overround = 1 / 1.9 + 1 / 1.95;
    expect(result?.closingOdds).toBe(1.95);
    expect(result?.closingLineValue).toBeCloseTo(
      1.88 * (1 / 1.95 / overround) - 1,
      10,
    );
  });

  it('stays null without the leg line or without its opposite at that line', () => {
    const rows = [corner('OVER', 9.5, 1.9), corner('UNDER', 10.5, 1.6)];
    const base = {
      market: Market.CORNERS,
      pick: 'UNDER',
      takenOdds: 1.88,
      preferredBookmaker: null,
      rows,
    };
    expect(resolveClosingLine({ ...base, line: 10.5 })).toBeNull();
    expect(resolveClosingLine({ ...base, line: null })).toBeNull();
  });
});

describe('readQuotedBookmaker', () => {
  it('lit le book de la citation du vivier LLM, sinon null', () => {
    expect(
      readQuotedBookmaker({ quote: { bookmaker: '1xBet', odds: 1.37 } }),
    ).toBe('1xBet');
    expect(readQuotedBookmaker({ expectedReturn: 0.95 })).toBeNull();
    expect(readQuotedBookmaker(null)).toBeNull();
  });
});
