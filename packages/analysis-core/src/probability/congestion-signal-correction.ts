import Decimal from "decimal.js";
import type { DerivedMarketsProba, ThreeWayProba } from "./markets";

type CongestionSignalProbabilities = ThreeWayProba & DerivedMarketsProba;

// Congestion (rest/schedule-density fatigue) logit-shift for OVER 2.5/BTTS —
// validated 2026-08-19 (db:backtest:congestion-signal-value, same
// logit-shift + grid-search protocol as the H2H market signals, tested ON
// TOP of the shrinkage config already in place): both markets show a real
// out-of-sample Brier gain (validation n=14217, ΔBrier -0.000095 OVER 2.5 /
// -0.000111 BTTS). The gain is real but an order of magnitude smaller than
// the H2H market signal (-0.0003 to -0.0016) — the combined home+away
// congestion score is 0 for the majority of fixtures (weekly domestic
// schedules rarely produce short rest), so there's little variance for it
// to explain on average, even though it plausibly matters more on the
// minority of fixtures where it isn't 0. Do not re-derive this delta by
// hand — rerun db:backtest:congestion-signal-value if recalibration is
// ever needed.
export const CONGESTION_SIGNAL_DELTA = -0.05;

const PROB_EPSILON = new Decimal("0.001");
const ONE = new Decimal(1);
const HALF = new Decimal("0.5");

function clampProb(value: Decimal): Decimal {
  return Decimal.min(Decimal.max(value, PROB_EPSILON), ONE.minus(PROB_EPSILON));
}

function logit(p: Decimal): Decimal {
  const clamped = clampProb(p);
  return clamped.div(ONE.minus(clamped)).ln();
}

function sigmoid(x: Decimal): Decimal {
  return ONE.div(ONE.plus(x.negated().exp()));
}

function shiftedProb(
  baseline: Decimal,
  signal: number,
  delta: number,
): Decimal {
  const shift = new Decimal(delta).times(new Decimal(signal).minus(HALF));
  return sigmoid(logit(baseline).plus(shift));
}

// Applies the same congestion-derived shift to OVER 2.5 and BTTS — unlike
// the H2H per-market signal (one rate per market, some legs null below the
// n>=3 gate), congestion is a single combined score always computable
// (falls back to 0 — "fully rested" — with no fixture history), so there's
// no null branch to handle. Complements (under25/bttsNo) are recomputed to
// stay a two-way split; every other field on `probabilities` passes
// through unchanged.
export function applyCongestionSignalCorrection<
  T extends CongestionSignalProbabilities,
>(probabilities: T, congestionScore: number): T {
  const over25 = shiftedProb(
    probabilities.over25,
    congestionScore,
    CONGESTION_SIGNAL_DELTA,
  );
  const bttsYes = shiftedProb(
    probabilities.bttsYes,
    congestionScore,
    CONGESTION_SIGNAL_DELTA,
  );

  return {
    ...probabilities,
    over25,
    under25: ONE.minus(over25),
    bttsYes,
    bttsNo: ONE.minus(bttsYes),
  };
}
