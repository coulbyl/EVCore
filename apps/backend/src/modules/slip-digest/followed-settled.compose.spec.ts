import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  composeFollowedSettled,
  type FollowedSettledLeg,
} from './followed-settled.compose';

function leg(overrides: Partial<FollowedSettledLeg>): FollowedSettledLeg {
  return {
    home: 'PSG',
    away: 'Lens',
    homeScore: 2,
    awayScore: 0,
    scheduledAt: new Date('2026-10-30T19:00:00.000Z'),
    isCorrect: true,
    operatorOdds: new Decimal('1.24'),
    ...overrides,
  };
}

describe('composeFollowedSettled', () => {
  it('a won Favori: the match, its score, the 1xBet odds', () => {
    expect(
      composeFollowedSettled({
        targetOddsMin: 1.1,
        source: 'PRICE_COMPOSER',
        result: 'WON',
        legs: [leg({})],
      }),
    ).toEqual({
      title: 'Ton Favori est passé ✓',
      body: 'PSG – Lens 2-0 · 1,24',
    });
  });

  it('a lost Combiné says where it broke, the first loss by kick-off', () => {
    expect(
      composeFollowedSettled({
        targetOddsMin: 1.2,
        source: 'ENGINE',
        result: 'LOST',
        legs: [
          leg({
            home: 'Lazio',
            away: 'Torino',
            homeScore: 1,
            awayScore: 0,
            isCorrect: false,
            scheduledAt: new Date('2026-10-30T20:45:00.000Z'),
          }),
          leg({
            home: 'Brest',
            away: 'Nantes',
            isCorrect: false,
            homeScore: 0,
            awayScore: 1,
            scheduledAt: new Date('2026-10-30T18:00:00.000Z'),
          }),
        ],
      }),
    ).toEqual({
      title: 'Ton Combiné a perdu ✗',
      body: 'cassé sur Brest – Nantes 0-1',
    });
  });

  it('a partial gain pays the won legs only; the LLM combo says so', () => {
    const message = composeFollowedSettled({
      targetOddsMin: 1.2,
      source: 'LLM',
      result: 'PARTIAL',
      legs: [
        leg({ operatorOdds: new Decimal('1.20') }),
        leg({ isCorrect: null, homeScore: null, awayScore: null }),
        leg({ operatorOdds: new Decimal('1.10') }),
      ],
    });
    // 1,20 × 1,10 = 1,32, the refunded leg paying 1.
    expect(message).toEqual({
      title: 'Ton Combiné IA est passé ✓',
      body: '2 matchs sur 3 · 1,32',
    });
  });

  it('no 1xBet price on a won leg: no odds rather than a borrowed one', () => {
    expect(
      composeFollowedSettled({
        targetOddsMin: 2,
        source: 'PRICE_COMPOSER',
        result: 'WON',
        legs: [leg({}), leg({ operatorOdds: null })],
      }).body,
    ).toBe('2 matchs');
  });

  it('a refunded coupon, and an unknown product', () => {
    expect(
      composeFollowedSettled({
        targetOddsMin: 99,
        source: 'ENGINE',
        result: 'VOID',
        legs: [leg({ isCorrect: null })],
      }),
    ).toEqual({
      title: 'Ton coupon est remboursé',
      body: 'match reporté ou annulé',
    });
  });

  it('never an amount or a gain in the text', () => {
    const { title, body } = composeFollowedSettled({
      targetOddsMin: 1.1,
      source: 'PRICE_COMPOSER',
      result: 'WON',
      legs: [leg({})],
    });
    expect(`${title} ${body}`).not.toMatch(/F\b|FCFA|€|gagn/);
  });
});
