import { describe, expect, it } from 'vitest';
import {
  buildImpliedProbability,
  buildLineMovement,
  buildMarketQuotes,
  type BookmakerQuote,
} from './market-block.builder';

const KICKOFF = new Date('2026-09-12T18:00:00.000Z');

function quote(overrides: Partial<BookmakerQuote> = {}): BookmakerQuote {
  return {
    market: 'ONE_X_TWO',
    pick: 'HOME',
    bookmaker: 'Bet365',
    latestOdds: 2,
    latestSnapshotAt: new Date('2026-09-12T06:00:00.000Z'),
    firstOdds: 2.2,
    firstSnapshotAt: new Date('2026-09-09T18:00:00.000Z'),
    snapshotCount: 6,
    ...overrides,
  };
}

describe('buildImpliedProbability', () => {
  it('retire la marge par normalisation proportionnelle sur un 1X2 complet', () => {
    const implied = buildImpliedProbability({
      market: 'ONE_X_TWO',
      pick: 'HOME',
      odds: 2,
      medianByPick: new Map([
        ['HOME', 2],
        ['DRAW', 4],
        ['AWAY', 4],
      ]),
    });

    // 1/2 + 1/4 + 1/4 = 1 exactement : marge nulle, dé-marginalisé = brut.
    expect(implied.raw).toBe(0.5);
    expect(implied.overround).toBe(1);
    expect(implied.deVigged).toBe(0.5);
    expect(implied.method).toBe('proportional');
  });

  it('abaisse la probabilité quand la marge est réelle', () => {
    const implied = buildImpliedProbability({
      market: 'BTTS',
      pick: 'YES',
      odds: 1.8,
      medianByPick: new Map([
        ['YES', 1.8],
        ['NO', 1.9],
      ]),
    });

    expect(implied.overround).toBeGreaterThan(1);
    expect(implied.deVigged).toBeLessThan(implied.raw as number);
  });

  it('refuse de dé-marginaliser TO_WIN_EITHER_HALF, dont les issues ne partitionnent pas', () => {
    const implied = buildImpliedProbability({
      market: 'TO_WIN_EITHER_HALF',
      pick: 'HOME',
      odds: 1.5,
      medianByPick: new Map([
        ['HOME', 1.5],
        ['AWAY', 2.1],
      ]),
    });

    expect(implied.raw).toBeCloseTo(0.6667, 4);
    expect(implied.deVigged).toBeNull();
    expect(implied.reason).toBe('no_complement_priced');
  });

  it('ne normalise pas sur une partition incomplète', () => {
    const implied = buildImpliedProbability({
      market: 'ONE_X_TWO',
      pick: 'HOME',
      odds: 2,
      // DRAW manquant : la marge n'est pas estimable.
      medianByPick: new Map([
        ['HOME', 2],
        ['AWAY', 4],
      ]),
    });

    expect(implied.raw).toBe(0.5);
    expect(implied.deVigged).toBeNull();
    expect(implied.reason).toBe('no_odds');
  });

  it('rend tout null quand la cote est absente', () => {
    const implied = buildImpliedProbability({
      market: 'BTTS',
      pick: 'YES',
      odds: null,
      medianByPick: new Map(),
    });

    expect(implied.raw).toBeNull();
    expect(implied.reason).toBe('no_odds');
  });
});

describe('buildLineMovement', () => {
  it('mesure le mouvement depuis le premier snapshot et dit de quand il date', () => {
    const movement = buildLineMovement({
      quotes: [quote({ firstOdds: 2.5, latestOdds: 2 })],
      kickoff: KICKOFF,
    });

    // (2.5 − 2) / 2.5 = 0.2 : la cote a raccourci de 20 %.
    expect(movement.movement).toBe(0.2);
    expect(movement.baselineHoursBeforeKickoff).toBe(72);
    expect(movement.firstOdds).toBe(2.5);
    expect(movement.latestOdds).toBe(2);
  });

  it('rend un mouvement négatif quand la cote s’allonge', () => {
    const movement = buildLineMovement({
      quotes: [quote({ firstOdds: 2, latestOdds: 2.5 })],
      kickoff: KICKOFF,
    });

    expect(movement.movement).toBeLessThan(0);
  });

  it('n’invente pas de mouvement sur un snapshot unique', () => {
    const instant = new Date('2026-09-12T06:00:00.000Z');
    const movement = buildLineMovement({
      quotes: [
        quote({
          firstSnapshotAt: instant,
          latestSnapshotAt: instant,
          snapshotCount: 1,
        }),
      ],
      kickoff: KICKOFF,
    });

    expect(movement.movement).toBeNull();
    expect(movement.reason).toBe('single_snapshot');
  });

  it('motive l’absence de cotes', () => {
    const movement = buildLineMovement({ quotes: [], kickoff: KICKOFF });

    expect(movement.reason).toBe('no_odds');
    expect(movement.snapshotCount).toBe(0);
  });
});

describe('buildMarketQuotes', () => {
  it('rend toujours les 7 marchés cibles, même sans aucune cote', () => {
    const markets = buildMarketQuotes({ quotes: [], kickoff: KICKOFF });

    expect(markets).toHaveLength(7);
    expect(markets.map((m) => m.key)).toEqual([
      'HOME',
      'AWAY',
      'WIN_EITHER_HALF_HOME',
      'WIN_EITHER_HALF_AWAY',
      'BTTS_YES',
      'OVER_1_5',
      'OVER_2_5',
    ]);
    expect(markets.every((m) => m.reason === 'no_odds')).toBe(true);
  });

  it('retient la meilleure cote et calcule la médiane sur les bookmakers', () => {
    const markets = buildMarketQuotes({
      quotes: [
        quote({ bookmaker: 'Bet365', latestOdds: 2 }),
        quote({ bookmaker: 'Pinnacle', latestOdds: 2.4 }),
        quote({ bookmaker: 'Unibet', latestOdds: 2.2 }),
      ],
      kickoff: KICKOFF,
    });

    const home = markets.find((m) => m.key === 'HOME');
    expect(home?.bestOdds).toBe(2.4);
    expect(home?.bestBookmaker).toBe('Pinnacle');
    expect(home?.medianOdds).toBe(2.2);
    expect(home?.bookmakerCount).toBe(3);
  });

  it('utilise les issues complémentaires pour la marge sans les exposer comme cibles', () => {
    const markets = buildMarketQuotes({
      quotes: [
        quote({ market: 'BTTS', pick: 'YES', latestOdds: 1.8 }),
        quote({ market: 'BTTS', pick: 'NO', latestOdds: 1.9 }),
      ],
      kickoff: KICKOFF,
    });

    const btts = markets.find((m) => m.key === 'BTTS_YES');
    expect(btts?.implied.deVigged).not.toBeNull();
    expect(btts?.implied.outcomes).toEqual(['YES', 'NO']);
    // Le complément NO ne devient pas un marché cible pour autant.
    expect(markets.some((m) => m.pick === 'NO')).toBe(false);
  });

  it('distingue la ligne 1.5 de la ligne 2.5 sur OVER_UNDER', () => {
    const markets = buildMarketQuotes({
      quotes: [
        quote({ market: 'OVER_UNDER', pick: 'OVER_1_5', latestOdds: 1.25 }),
        quote({ market: 'OVER_UNDER', pick: 'UNDER_1_5', latestOdds: 3.9 }),
        quote({ market: 'OVER_UNDER', pick: 'OVER', latestOdds: 1.95 }),
        quote({ market: 'OVER_UNDER', pick: 'UNDER', latestOdds: 1.9 }),
      ],
      kickoff: KICKOFF,
    });

    expect(markets.find((m) => m.key === 'OVER_1_5')?.bestOdds).toBe(1.25);
    expect(markets.find((m) => m.key === 'OVER_2_5')?.bestOdds).toBe(1.95);
    expect(markets.find((m) => m.key === 'OVER_1_5')?.implied.outcomes).toEqual(
      ['OVER_1_5', 'UNDER_1_5'],
    );
  });
});
