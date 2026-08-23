import { describe, expect, it } from 'vitest';
import { buildStats } from './investment-channel-stats.repository';

type Row = {
  channel: string;
  probability: number;
  odds: number;
  won: boolean;
};

/** `count` sélections d'un canal, dont `wins` gagnantes, toutes à la même cote. */
function rows(input: {
  channel: string;
  count: number;
  wins: number;
  odds: number;
  probability?: number;
}): Row[] {
  const { channel, count, wins, odds, probability = 0.5 } = input;
  return Array.from({ length: count }, (_, i) => ({
    channel,
    probability,
    odds,
    won: i < wins,
  }));
}

describe('buildStats — ROI shrinké', () => {
  it('ramène un canal à faible volume vers la moyenne globale', () => {
    // « bruyant » affiche +87.5% brut sur 4 lignes ; « solide » est à -5% sur
    // 4 000. Un ROI brut laisserait le premier écraser le second.
    const sample = [
      ...rows({ channel: 'BRUYANT', count: 4, wins: 3, odds: 2.5 }),
      ...rows({ channel: 'SOLIDE', count: 4000, wins: 1800, odds: 2.1 }),
    ];

    const stats = buildStats(sample);

    // 3 gagnées à +1.5, 1 perdue à -1 -> (4.5 - 1) / 4 = 0.875
    expect(stats.BRUYANT?.roiRaw).toBeCloseTo(0.875, 6);
    expect(stats.BRUYANT?.roiShrunk).toBeLessThan(stats.BRUYANT.roiRaw);
    expect(stats.BRUYANT?.roiWeight).toBeLessThan(0.5);
    // Le canal massivement échantillonné garde l'essentiel de son signal.
    expect(stats.SOLIDE?.roiWeight).toBeGreaterThan(stats.BRUYANT.roiWeight);
    expect(stats.SOLIDE?.roiShrunk).toBeCloseTo(stats.SOLIDE.roiRaw, 2);
  });

  it("shrinke tout jusqu'à la moyenne quand rien ne distingue les canaux", () => {
    // Deux canaux au même ROI : la variance observée entre eux ne dépasse pas
    // la variance d'échantillonnage, donc t² tombe à zéro.
    const sample = [
      ...rows({ channel: 'A', count: 500, wins: 250, odds: 2 }),
      ...rows({ channel: 'B', count: 500, wins: 250, odds: 2 }),
    ];

    const stats = buildStats(sample);

    expect(stats.A?.roiWeight).toBe(0);
    expect(stats.A?.roiShrunk).toBeCloseTo(0, 6);
  });

  it('mesure le ROI mise plate et le taux de réussite du canal', () => {
    const sample = rows({ channel: 'A', count: 100, wins: 40, odds: 3 });

    const stats = buildStats(sample);

    // 40 gagnées à +2, 60 perdues à -1 -> (80 - 60) / 100 = 0.2
    expect(stats.A?.roiRaw).toBeCloseTo(0.2, 6);
    expect(stats.A?.hitRate).toBeCloseTo(0.4, 6);
    expect(stats.A?.n).toBe(100);
  });

  it('renvoie une carte vide sans données', () => {
    expect(buildStats([])).toEqual({});
  });
});

describe('buildStats — courbe de fiabilité', () => {
  it('aplatit un canal sur-confiant', () => {
    // Annoncé 0.8, réalisé 0.5 : la courbe doit corriger vers le bas.
    const sample = [
      ...rows({
        channel: 'SURCONF',
        count: 1000,
        wins: 500,
        odds: 2,
        probability: 0.8,
      }),
      ...rows({
        channel: 'AUTRE',
        count: 1000,
        wins: 500,
        odds: 2,
        probability: 0.5,
      }),
    ];

    const stats = buildStats(sample);
    const { a, b } = stats.SURCONF.reliability;
    const corrected = 1 / (1 + Math.exp(-(a * Math.log(0.8 / 0.2) + b)));

    expect(corrected).toBeLessThan(0.8);
    expect(stats.SURCONF?.reliability.n).toBe(1000);
  });
});
