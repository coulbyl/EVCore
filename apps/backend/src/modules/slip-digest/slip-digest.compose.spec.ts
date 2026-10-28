import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import type { SlipMoney } from '@modules/bet-slip/bet-slip-outcome';
import { composeSlipDigest, formatMoney } from './slip-digest.compose';

function result(
  status: SlipMoney['status'],
  settledStake: number,
  returned: number,
): SlipMoney {
  const d = (n: number) => new Decimal(n);
  return {
    status,
    staked: d(settledStake),
    settledStake: status === 'PENDING' ? d(0) : d(settledStake),
    returned: d(returned),
    net: d(returned - settledStake),
    pendingStake: status === 'PENDING' ? d(settledStake) : d(0),
    potentialReturn: d(0),
  };
}

describe('composeSlipDigest', () => {
  it('writes a loss with the same words as a gain', () => {
    const message = composeSlipDigest(
      [result('WON', 1000, 1540), result('LOST', 1000, 0)],
      'XOF',
    );
    expect(message?.title).toBe("Tes coupons d'hier");
    expect(message?.body).toBe(
      '2 coupons réglés : 1 gagné, 1 perdu. Misé 2 000 F, rendu 1 540 F : -460 F.',
    );
    expect(message?.net).toBe('-460.00');
  });

  it('counts refunds and still-pending coupons', () => {
    const message = composeSlipDigest(
      [
        result('WON', 2000, 2660),
        result('VOID', 1000, 1000),
        result('PENDING', 1000, 0),
      ],
      'XOF',
    );
    expect(message?.body).toContain(
      '2 coupons réglés : 1 gagné, 0 perdu, 1 remboursé.',
    );
    expect(message?.body).toContain(': +660 F.');
    expect(message?.body).toMatch(/1 coupon encore en attente\.$/);
  });

  it('sends nothing when no coupon is settled yet', () => {
    expect(composeSlipDigest([result('PENDING', 1000, 0)], 'XOF')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('rounds francs CFA to the franc and signs on request', () => {
    expect(formatMoney(new Decimal('537.6'), 'XOF', true)).toBe('+538 F');
    expect(formatMoney(new Decimal('-0.4'), 'XOF', true)).toBe('0 F');
  });

  it('keeps cents for euros and puts the dollar sign first', () => {
    expect(formatMoney(new Decimal('12.5'), 'EUR')).toBe('12,5 €');
    expect(formatMoney(new Decimal('-3'), 'USD', true)).toBe('-$3');
  });
});
