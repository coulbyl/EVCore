import { describe, expect, it } from 'vitest';
import {
  applyReliability,
  fitReliability,
  IDENTITY_RELIABILITY,
  logit,
  shrinkTowardPooled,
  sigmoid,
  type ReliabilityObservation,
} from './channel-reliability';

// Deterministic pseudo-random draw — Math.random() would make a failure
// impossible to reproduce.
function makeRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/**
 * Generates observations whose TRUE probability is a known distortion of the
 * announced one — `trueP = sigmoid(a * logit(announced) + b)` — so the fit has
 * a right answer to recover.
 */
function generate(opts: {
  n: number;
  a: number;
  b: number;
  seed: number;
}): ReliabilityObservation[] {
  const rng = makeRng(opts.seed);
  const out: ReliabilityObservation[] = [];
  for (let i = 0; i < opts.n; i += 1) {
    const announced = 0.1 + (0.85 - 0.1) * rng();
    const trueP = sigmoid(opts.a * logit(announced) + opts.b);
    out.push({ probability: announced, won: rng() < trueP });
  }
  return out;
}

describe('logit / sigmoid', () => {
  it('round-trips', () => {
    for (const p of [0.05, 0.3, 0.5, 0.75, 0.99]) {
      expect(sigmoid(logit(p))).toBeCloseTo(p, 10);
    }
  });

  it('clamps degenerate probabilities instead of returning infinity', () => {
    expect(Number.isFinite(logit(0))).toBe(true);
    expect(Number.isFinite(logit(1))).toBe(true);
  });
});

describe('fitReliability', () => {
  it('returns the identity curve on an empty sample', () => {
    expect(fitReliability([])).toEqual(IDENTITY_RELIABILITY);
  });

  it('recovers a known flattening distortion', () => {
    const fit = fitReliability(
      generate({ n: 20000, a: 0.4, b: -0.3, seed: 7 }),
    );
    expect(fit.a).toBeGreaterThan(0.25);
    expect(fit.a).toBeLessThan(0.55);
    expect(fit.b).toBeLessThan(0);
  });

  it('recovers an identity distortion as a slope near 1', () => {
    const fit = fitReliability(generate({ n: 20000, a: 1, b: 0, seed: 11 }));
    expect(fit.a).toBeGreaterThan(0.8);
    expect(fit.a).toBeLessThan(1.2);
    expect(Math.abs(fit.b)).toBeLessThan(0.2);
  });

  it('stays finite when every announced probability is identical (no slope information)', () => {
    const flat: ReliabilityObservation[] = Array.from(
      { length: 200 },
      (_, i) => ({ probability: 0.6, won: i % 2 === 0 }),
    );
    const fit = fitReliability(flat);
    expect(Number.isFinite(fit.a)).toBe(true);
    expect(Number.isFinite(fit.b)).toBe(true);
  });
});

describe('applyReliability', () => {
  it('is a no-op under the identity curve', () => {
    expect(applyReliability(0.73, IDENTITY_RELIABILITY)).toBeCloseTo(0.73, 10);
  });

  it('a slope below 1 pulls both tails toward the middle', () => {
    const flattening = { a: 0.4, b: 0, n: 1000 };
    expect(applyReliability(0.9, flattening)).toBeLessThan(0.9);
    expect(applyReliability(0.1, flattening)).toBeGreaterThan(0.1);
  });
});

describe('shrinkTowardPooled', () => {
  const pooled = { a: 0.5, b: -0.2, n: 50000 };

  it('leaves a large-sample channel close to its own fit', () => {
    const own = { a: 1.0, b: 0.4, n: 30000 };
    const shrunk = shrinkTowardPooled(own, pooled, 300);
    expect(shrunk.a).toBeGreaterThan(0.98);
    expect(shrunk.b).toBeGreaterThan(0.39);
  });

  it('pulls a thin channel most of the way to the pooled fit', () => {
    const own = { a: 1.0, b: 0.4, n: 30 };
    const shrunk = shrinkTowardPooled(own, pooled, 300);
    expect(shrunk.a).toBeLessThan(0.56);
    expect(shrunk.b).toBeLessThan(-0.14);
  });

  it('is continuous — no cliff between n just under and just over any threshold', () => {
    const at49 = shrinkTowardPooled({ a: 1, b: 0.4, n: 49 }, pooled, 300);
    const at51 = shrinkTowardPooled({ a: 1, b: 0.4, n: 51 }, pooled, 300);
    expect(Math.abs(at51.a - at49.a)).toBeLessThan(0.01);
  });

  it('an empty channel lands exactly on the pooled fit', () => {
    const shrunk = shrinkTowardPooled({ a: 9, b: 9, n: 0 }, pooled, 300);
    expect(shrunk.a).toBeCloseTo(pooled.a, 10);
    expect(shrunk.b).toBeCloseTo(pooled.b, 10);
  });
});
