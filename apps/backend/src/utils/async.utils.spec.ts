import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './async.utils';

describe('mapWithConcurrency', () => {
  it('traite chaque élément exactement une fois', async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4, 5], 2, (item) => {
      seen.push(item);
      return Promise.resolve();
    });
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  // La propriété qui justifie ce module : le pool de connexions vaut 10, et
  // un marché à trente lignes le saturerait avec un Promise.all.
  it("ne dépasse jamais la limite d'appels simultanés", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 30 }, (_, index) => index),
      5,
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
      },
    );
    expect(peak).toBeLessThanOrEqual(5);
    expect(peak).toBeGreaterThan(1);
  });

  it("n'ouvre pas plus de tâches que d'éléments", async () => {
    let peak = 0;
    let inFlight = 0;
    await mapWithConcurrency([1, 2], 10, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('accepte une liste vide et une limite absurde', async () => {
    await expect(
      mapWithConcurrency([], 5, () => Promise.resolve()),
    ).resolves.toBeUndefined();
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3], 0, (item) => {
      seen.push(item);
      return Promise.resolve();
    });
    expect(seen).toEqual([1, 2, 3]);
  });

  it('propage la première erreur rencontrée', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, (item) =>
        item === 2 ? Promise.reject(new Error('boom')) : Promise.resolve(),
      ),
    ).rejects.toThrow('boom');
  });
});
