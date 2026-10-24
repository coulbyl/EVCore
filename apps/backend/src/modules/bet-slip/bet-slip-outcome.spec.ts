import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { fixedStakeOutcome, type PlayedSlip } from './bet-slip-outcome';

const d = (n: number) => new Decimal(n);

describe('fixedStakeOutcome', () => {
  it('counts each leg of a SIMPLE slip as its own one-unit bet', () => {
    const slips: PlayedSlip[] = [
      {
        type: 'SIMPLE',
        items: [
          { status: 'WON', odds: d(1.5) },
          { status: 'LOST', odds: d(1.4) },
          { status: 'PENDING', odds: d(1.3) },
        ],
      },
    ];
    const out = fixedStakeOutcome(slips);
    expect(out).toMatchObject({
      wonPlays: 1,
      lostPlays: 1,
      pendingPlays: 1,
      settledPlays: 2,
    });
    // +0,50 − 1 = −0,50 sur 2 paris réglés
    expect(out.profitUnits.toNumber()).toBeCloseTo(-0.5, 10);
    expect(out.returnRate?.toNumber()).toBeCloseTo(-0.25, 10);
  });

  it('settles a COMBO as one bet at the product of its winning legs', () => {
    const out = fixedStakeOutcome([
      {
        type: 'COMBO',
        items: [
          { status: 'WON', odds: d(1.2) },
          { status: 'WON', odds: d(1.5) },
          { status: 'VOID', odds: d(1.8) },
        ],
      },
    ]);
    expect(out.wonPlays).toBe(1);
    expect(out.settledPlays).toBe(1);
    // 1,2 × 1,5 = 1,8 → +0,80 ; la jambe remboursée vaut une cote de 1
    expect(out.profitUnits.toNumber()).toBeCloseTo(0.8, 10);
  });

  it('loses a COMBO on any lost leg, even with another leg pending', () => {
    const out = fixedStakeOutcome([
      {
        type: 'COMBO',
        items: [
          { status: 'LOST', odds: d(1.3) },
          { status: 'PENDING', odds: d(1.3) },
        ],
      },
    ]);
    expect(out).toMatchObject({ lostPlays: 1, pendingPlays: 0 });
    expect(out.profitUnits.toNumber()).toBe(-1);
  });

  it('keeps a COMBO pending while a leg is pending and none is lost', () => {
    const out = fixedStakeOutcome([
      {
        type: 'COMBO',
        items: [
          { status: 'WON', odds: d(1.3) },
          { status: 'PENDING', odds: d(1.3) },
        ],
      },
    ]);
    expect(out).toMatchObject({ pendingPlays: 1, settledPlays: 0 });
    expect(out.returnRate).toBeNull();
  });

  it('reports no rate when nothing is settled, and ignores refunds', () => {
    const out = fixedStakeOutcome([
      { type: 'SIMPLE', items: [{ status: 'VOID', odds: d(2) }] },
    ]);
    expect(out).toMatchObject({ voidPlays: 1, settledPlays: 0 });
    expect(out.returnRate).toBeNull();
  });
});
