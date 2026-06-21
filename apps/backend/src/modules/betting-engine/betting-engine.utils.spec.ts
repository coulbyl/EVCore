import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { bookmakerMargin, removeOverround } from './betting-engine.utils';

describe('bookmakerMargin', () => {
  it('measures the overround of a fair 1X2 book (Σ 1/odds − 1)', () => {
    // 1/2.0 + 1/3.5 + 1/4.0 = 0.5 + 0.285714 + 0.25 = 1.035714 → margin ≈ 0.0357
    const margin = bookmakerMargin([
      new Decimal('2.0'),
      new Decimal('3.5'),
      new Decimal('4.0'),
    ]);
    expect(margin.toNumber()).toBeCloseTo(0.0357142857, 9);
  });

  it('is ≈ 0 for a margin-free two-way book at evens', () => {
    expect(
      bookmakerMargin([new Decimal('2'), new Decimal('2')]).toNumber(),
    ).toBe(0);
  });

  it('accepts plain number odds', () => {
    expect(bookmakerMargin([2, 2]).toNumber()).toBe(0);
  });

  it('throws on empty input', () => {
    expect(() => bookmakerMargin([])).toThrow(RangeError);
  });

  it('throws on invalid decimal odds (≤ 1)', () => {
    expect(() => bookmakerMargin([new Decimal('1'), new Decimal('2')])).toThrow(
      RangeError,
    );
    expect(() => bookmakerMargin([new Decimal('0.5')])).toThrow(RangeError);
  });
});

describe('removeOverround', () => {
  it('returns fair probabilities that sum to exactly 1', () => {
    const fair = removeOverround([
      new Decimal('2.0'),
      new Decimal('3.5'),
      new Decimal('4.0'),
    ]);
    const total = fair.reduce((a, b) => a.plus(b), new Decimal(0));
    expect(total.toNumber()).toBeCloseTo(1, 12);
  });

  it('renormalises each implied probability by the total (removes the margin)', () => {
    const odds = [new Decimal('2.0'), new Decimal('3.5'), new Decimal('4.0')];
    const total = 1 / 2.0 + 1 / 3.5 + 1 / 4.0;
    const fair = removeOverround(odds);
    expect(fair[0].toNumber()).toBeCloseTo(1 / 2.0 / total, 12);
    expect(fair[1].toNumber()).toBeCloseTo(1 / 3.5 / total, 12);
    expect(fair[2].toNumber()).toBeCloseTo(1 / 4.0 / total, 12);
  });

  it('halves to 0.5/0.5 for a symmetric two-way book', () => {
    const fair = removeOverround([new Decimal('1.9'), new Decimal('1.9')]);
    expect(fair[0].toNumber()).toBeCloseTo(0.5, 12);
    expect(fair[1].toNumber()).toBeCloseTo(0.5, 12);
  });

  it('throws on empty input', () => {
    expect(() => removeOverround([])).toThrow(RangeError);
  });

  it('throws on invalid decimal odds (≤ 1)', () => {
    expect(() => removeOverround([new Decimal('1'), new Decimal('3')])).toThrow(
      RangeError,
    );
  });
});
