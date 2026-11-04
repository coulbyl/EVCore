/**
 * Day-block bootstrap shared by the replay scripts: picks of one day share
 * a calendar, a market state and often a fixture, so whole days are
 * resampled, never single picks (evcore-forecast-audit § 7). Seeded: a
 * report rerun on the same data prints the same intervals.
 */

/** Mulberry32, a seeded uniform generator on [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type BootstrapOptions = { draws: number; seed: number };

/**
 * Mean of `rows` and its 95 % interval, resampling whole days. NaN for no
 * row.
 */
export function meanCi(
  rows: ReadonlyArray<{ day: string; value: number }>,
  options: BootstrapOptions,
): { mean: number; lo: number; hi: number } {
  if (rows.length === 0) return { mean: NaN, lo: NaN, hi: NaN };
  const byDay = new Map<string, number[]>();
  for (const r of rows) {
    const bucket = byDay.get(r.day);
    if (bucket) bucket.push(r.value);
    else byDay.set(r.day, [r.value]);
  }
  const days = [...byDay.values()];
  const mean = rows.reduce((s, r) => s + r.value, 0) / rows.length;
  const random = mulberry32(options.seed);
  const draws: number[] = [];
  for (let b = 0; b < options.draws; b++) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < days.length; i++) {
      const day = days[Math.floor(random() * days.length)] as number[];
      for (const v of day) sum += v;
      n += day.length;
    }
    draws.push(sum / n);
  }
  draws.sort((x, y) => x - y);
  return {
    mean,
    lo: draws[Math.floor(0.025 * options.draws)] as number,
    hi: draws[Math.floor(0.975 * options.draws)] as number,
  };
}

/**
 * A statistic of per-day sums and its 95 % interval, resampling whole days:
 * `days[d]` holds day d's sums (same width every day), `stat` maps the
 * summed vector to the statistic (a ratio of sums, a difference of means).
 * Non-finite draws (an empty denominator) are dropped.
 */
export function bootstrapDaySums(
  days: readonly number[][],
  stat: (sums: number[]) => number,
  options: BootstrapOptions,
): { value: number; lo: number; hi: number } {
  const width = days[0]?.length ?? 0;
  const total = (indices: Iterable<number>): number[] => {
    const sums = new Array<number>(width).fill(0);
    for (const i of indices) {
      const day = days[i] as number[];
      for (let k = 0; k < width; k++) sums[k] = (sums[k] ?? 0) + (day[k] ?? 0);
    }
    return sums;
  };
  const value = stat(total(days.keys()));
  const rng = mulberry32(options.seed);
  const draws: number[] = [];
  for (let b = 0; b < options.draws; b++) {
    const picks = Array.from({ length: days.length }, () =>
      Math.floor(rng() * days.length),
    );
    const v = stat(total(picks));
    if (Number.isFinite(v)) draws.push(v);
  }
  draws.sort((x, y) => x - y);
  const at = (q: number) => draws[Math.floor(q * (draws.length - 1))] ?? NaN;
  return { value, lo: at(0.025), hi: at(0.975) };
}
