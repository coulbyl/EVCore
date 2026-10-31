import { describe, it, expect } from 'vitest';
import {
  composeMorningBrief,
  composeWeeklyStatement,
} from './slip-digest.compose';

describe('composeMorningBrief', () => {
  it('tells the followed coupons, then the coupons of the day, without any amount', () => {
    const message = composeMorningBrief({
      follows: [
        { targetOddsMin: 1.2, result: 'WON' },
        { targetOddsMin: 1.36, result: 'LOST' },
      ],
      coupons: [{ couponClass: 'FAVOURITE', odds: 1.28 }],
      abstentions: [],
    });
    expect(message?.title).toBe('Ta matinée EVCore');
    expect(message?.body).toContain('Coupons suivis :');
    expect(message?.body).toContain('Coupons du jour : Favori 1,28.');
    expect(message?.body).not.toMatch(/F CFA|XOF|Misé|rendu/);
  });

  it('says nothing when there is nothing to say', () => {
    expect(
      composeMorningBrief({ follows: [], coupons: [], abstentions: [] }),
    ).toBeNull();
  });
});

describe('composeWeeklyStatement', () => {
  it('counts the followed coupons won and our products', () => {
    const message = composeWeeklyStatement({
      follows: [
        { targetOddsMin: 1.2, result: 'WON' },
        { targetOddsMin: 1.2, result: 'PARTIAL' },
        { targetOddsMin: 1.36, result: 'LOST' },
      ],
      products: [{ couponClass: 'FAVOURITE', won: 5, settled: 6 }],
    });
    expect(message?.body).toBe(
      'Coupons suivis : 2 gagnés sur 3. Nos coupons : Favori 5 jours gagnés sur 6.',
    );
  });

  it('says nothing for an empty week', () => {
    expect(composeWeeklyStatement({ follows: [], products: [] })).toBeNull();
  });
});
