import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  fixedStakeOutcome,
  slipMoney,
  sumSlipMoney,
  type PlayedSlip,
} from './bet-slip-outcome';

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

describe('slipMoney', () => {
  const dec = (v: string | number) => new Decimal(v);

  it('pays a combo with a refunded leg at the odds of its won legs', () => {
    const money = slipMoney({
      type: 'COMBO',
      unitStake: dec(400000),
      items: [
        { status: 'WON', odds: dec('1.33'), stake: dec(400000) },
        { status: 'VOID', odds: dec('1.57'), stake: dec(400000) },
      ],
    });
    expect(money.status).toBe('WON');
    expect(money.returned.toFixed(2)).toBe('532000.00');
    expect(money.net.toFixed(2)).toBe('132000.00');
  });

  it('returns the stake of a fully refunded combo, at zero result', () => {
    const money = slipMoney({
      type: 'COMBO',
      unitStake: dec(1000),
      items: [
        { status: 'VOID', odds: dec('1.5'), stake: dec(1000) },
        { status: 'VOID', odds: dec('2'), stake: dec(1000) },
      ],
    });
    expect(money.status).toBe('VOID');
    expect(money.returned.toFixed(2)).toBe('1000.00');
    expect(money.net.toFixed(2)).toBe('0.00');
  });

  it('keeps a combo pending with its potential return, refunds at 1', () => {
    const money = slipMoney({
      type: 'COMBO',
      unitStake: dec(1000),
      items: [
        { status: 'WON', odds: dec('1.5'), stake: dec(1000) },
        { status: 'VOID', odds: dec('3'), stake: dec(1000) },
        { status: 'PENDING', odds: dec('2'), stake: dec(1000) },
      ],
    });
    expect(money.status).toBe('PENDING');
    expect(money.pendingStake.toFixed(2)).toBe('1000.00');
    expect(money.potentialReturn.toFixed(2)).toBe('3000.00');
    expect(money.net.toFixed(2)).toBe('0.00');
  });

  it('settles a refunded single instead of leaving it pending', () => {
    const money = slipMoney({
      type: 'SIMPLE',
      unitStake: dec(1000),
      items: [
        { status: 'WON', odds: dec('1.54'), stake: dec(1000) },
        { status: 'VOID', odds: dec('1.8'), stake: dec(1000) },
        { status: 'LOST', odds: dec('2'), stake: dec(500) },
      ],
    });
    expect(money.status).toBe('WON');
    expect(money.settledStake.toFixed(2)).toBe('2500.00');
    expect(money.returned.toFixed(2)).toBe('2540.00');
    expect(money.net.toFixed(2)).toBe('40.00');
    expect(money.pendingStake.toFixed(2)).toBe('0.00');
  });

  it('never shows a won combo without odds as a loss', () => {
    const money = slipMoney({
      type: 'COMBO',
      unitStake: dec(1000),
      items: [
        { status: 'WON', odds: null, stake: dec(1000) },
        { status: 'WON', odds: dec('1.5'), stake: dec(1000) },
      ],
    });
    expect(money.status).toBe('WON');
    expect(money.settledStake.toFixed(2)).toBe('0.00');
    expect(money.net.toFixed(2)).toBe('0.00');
  });

  it('counts a won single without odds as won, outside the amounts', () => {
    const alone = slipMoney({
      type: 'SIMPLE',
      unitStake: dec(1000),
      items: [{ status: 'WON', odds: null, stake: dec(1000) }],
    });
    expect(alone.status).toBe('WON');
    expect(alone.net.toFixed(2)).toBe('0.00');

    const withLoss = slipMoney({
      type: 'SIMPLE',
      unitStake: dec(1000),
      items: [
        { status: 'WON', odds: null, stake: dec(1000) },
        { status: 'LOST', odds: dec('2'), stake: dec(500) },
      ],
    });
    expect(withLoss.settledStake.toFixed(2)).toBe('500.00');
    expect(withLoss.net.toFixed(2)).toBe('-500.00');
  });
});

describe('sumSlipMoney', () => {
  const dec = (v: string | number) => new Decimal(v);

  it('takes settled amounts only from fully settled slips', () => {
    const settled = slipMoney({
      type: 'SIMPLE',
      unitStake: dec(1000),
      items: [{ status: 'WON', odds: dec('1.5'), stake: dec(1000) }],
    });
    // One leg already lost, one still pending: the slip is not settled yet.
    const partly = slipMoney({
      type: 'SIMPLE',
      unitStake: dec(1000),
      items: [
        { status: 'LOST', odds: dec('2'), stake: dec(1000) },
        { status: 'PENDING', odds: dec('2'), stake: dec(1000) },
      ],
    });
    const totals = sumSlipMoney([settled, partly]);
    expect(totals.settledSlips).toBe(1);
    expect(totals.pendingSlips).toBe(1);
    expect(totals.settledStake.toFixed(2)).toBe('1000.00');
    expect(totals.returned.toFixed(2)).toBe('1500.00');
    expect(totals.net.toFixed(2)).toBe('500.00');
    expect(totals.pendingStake.toFixed(2)).toBe('2000.00');
  });
});
