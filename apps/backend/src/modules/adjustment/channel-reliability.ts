import { CHANNEL_RELIABILITY_PRIOR_WEIGHT } from './adjustment.constants';

/**
 * Per-channel probability recalibration — Platt scaling on the logit scale.
 *
 * Why a slope and not just a mean shift (which is what `CalibrationService
 * .computeForMarket`'s `meanError` gives): measured 2026-08-22 across every
 * settled rank-1 selection, the reliability curve is far FLATTER than the
 * diagonal, it is not merely offset. Announced probability moves 0.46 -> 0.81
 * while the realised rate moves only 0.46 -> 0.59. Subtracting a constant
 * cannot fix a wrong slope: it would leave the low end under-corrected and the
 * high end still over-confident.
 *
 * The bias is also channel-specific — ratio (realised / announced) ranges from
 * 1.016 (DRAW) to 0.623 (RESULT_BTTS) — so one pooled curve is not enough
 * either. Hence one (a, b) pair per channel:
 *
 *     p_calibrated = sigmoid(a * logit(p_raw) + b)
 *
 * a = 1, b = 0 is the identity. a < 1 flattens an over-confident channel
 * toward its base rate, which is the shape every channel here actually needs.
 */
export type ChannelReliability = {
  /** Slope on the logit scale. 1 = leave the channel's spread untouched. */
  a: number;
  /** Intercept on the logit scale. 0 = leave the channel's level untouched. */
  b: number;
  /** Settled selections the fit was computed on (before shrinkage). */
  n: number;
};

export type ChannelReliabilityMap = Record<string, ChannelReliability>;

export const IDENTITY_RELIABILITY: ChannelReliability = { a: 1, b: 0, n: 0 };

// Probabilities are clamped before logit so a degenerate 0 or 1 estimate
// cannot produce an infinite feature and blow up the fit.
const P_EPSILON = 1e-6;

export function logit(p: number): number {
  const clamped = Math.min(1 - P_EPSILON, Math.max(P_EPSILON, p));
  return Math.log(clamped / (1 - clamped));
}

export function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

export type ReliabilityObservation = {
  probability: number;
  won: boolean;
};

const MAX_ITERATIONS = 50;
const CONVERGENCE_TOLERANCE = 1e-8;
// Ridge term on the 2x2 normal equations. Keeps the fit defined when a
// channel's announced probabilities have (near-)zero variance — a real case
// here: a channel that always announces the same probability carries no slope
// information at all, and without this the IRLS step is singular.
const RIDGE = 1e-6;

/**
 * Fits (a, b) by iteratively reweighted least squares — the standard solver
 * for a 2-parameter logistic regression. Returns the identity fit when there
 * is nothing to fit on, so callers never have to special-case an empty sample.
 */
export function fitReliability(
  observations: readonly ReliabilityObservation[],
): ChannelReliability {
  if (observations.length === 0) return IDENTITY_RELIABILITY;

  const points = observations.map((o) => ({
    x: logit(o.probability),
    y: o.won ? 1 : 0,
  }));

  let a = 1;
  let b = 0;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    // Accumulate the weighted normal equations H * delta = g.
    let h00 = RIDGE;
    let h01 = 0;
    let h11 = RIDGE;
    let g0 = 0;
    let g1 = 0;

    for (const { x, y } of points) {
      const p = sigmoid(a * x + b);
      const w = Math.max(p * (1 - p), 1e-10);
      const residual = y - p;
      g0 += x * residual;
      g1 += residual;
      h00 += w * x * x;
      h01 += w * x;
      h11 += w;
    }

    const det = h00 * h11 - h01 * h01;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) break;

    const deltaA = (h11 * g0 - h01 * g1) / det;
    const deltaB = (h00 * g1 - h01 * g0) / det;
    a += deltaA;
    b += deltaB;

    if (
      Math.abs(deltaA) < CONVERGENCE_TOLERANCE &&
      Math.abs(deltaB) < CONVERGENCE_TOLERANCE
    ) {
      break;
    }
  }

  if (!Number.isFinite(a) || !Number.isFinite(b)) return IDENTITY_RELIABILITY;
  return { a, b, n: observations.length };
}

/**
 * James-Stein / empirical-Bayes shrinkage of a per-channel fit toward the
 * pooled fit, weighted by that channel's own sample size:
 *
 *     theta_channel' = (1 - t) * theta_pooled + t * theta_channel,
 *     t = n / (n + k)
 *
 * This is the continuous replacement for a hard `n >= MIN_BET_COUNT` cutoff.
 * The cutoff shape was tried on 2026-08-20 (per (channel, market) calibration)
 * and collapsed: splitting the sample pushed many groups under the threshold,
 * where they fell back to a far cruder estimate — the classic small-sample
 * groups problem that shrinkage exists to solve. A channel with n = 500 keeps
 * almost all of its own fit; one with n = 50 sits close to the pooled curve;
 * nothing ever falls off a cliff.
 */
export function shrinkTowardPooled(
  channel: ChannelReliability,
  pooled: ChannelReliability,
  k: number = CHANNEL_RELIABILITY_PRIOR_WEIGHT,
): ChannelReliability {
  const t = channel.n / (channel.n + k);
  return {
    a: pooled.a * (1 - t) + channel.a * t,
    b: pooled.b * (1 - t) + channel.b * t,
    n: channel.n,
  };
}

/** Applies a fitted reliability curve to a raw model probability. */
export function applyReliability(
  probability: number,
  reliability: ChannelReliability,
): number {
  return sigmoid(reliability.a * logit(probability) + reliability.b);
}
