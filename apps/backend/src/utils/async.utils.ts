export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Applique `task` à chaque élément, au plus `limit` en vol à la fois.
 *
 * Le pool de connexions vaut 10 par défaut (`DATABASE_POOL_MAX`). Un
 * `Promise.all` sur une liste longue émet donc bien plus de requêtes que le
 * pool n'en sert : elles s'y empilent, et une base lente fait expirer
 * l'acquisition. Le cas concret est le handicap asiatique, qu'un seul book
 * price sur une trentaine de lignes.
 *
 * Séquentiel serait sans risque mais trop lent pour le balayage de clôture,
 * dont la fenêtre se compte en minutes : borner est le compromis.
 */
export async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;
  const workers = Array.from({ length: effectiveLimit }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      if (item === undefined) continue;
      await task(item);
    }
  });
  await Promise.all(workers);
}
