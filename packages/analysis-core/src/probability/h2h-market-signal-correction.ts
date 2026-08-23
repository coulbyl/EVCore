import Decimal from "decimal.js";
import type { DerivedMarketsProba, ThreeWayProba } from "./markets";

type H2HMarketSignalProbabilities = ThreeWayProba & DerivedMarketsProba;

// H2H per-market signal correction — logit-shift toward the decay-weighted
// H2H rate for BTTS/OVER 2.5/CLEAN_SHEET/WIN_TO_NIL (H2HService.
// computeH2HMarketSignals). Validated in two backtests: standalone gain vs.
// the pre-H2H model (packages/db/reports/backtest-h2h-market-signals-
// 2026-07-23.txt, 5/6 markets, BTTS noise-level) and — the blocker this
// closes — a combined test showing the gain survives ON TOP OF the H2H
// lambda correction already active in prod since 2026-07-23 (packages/db/
// reports/backtest-h2h-market-signals-combined-2026-07-28.txt, 6/6 markets,
// n=9010 validation). Deltas below are the grid-search optimum from that
// combined report — do not re-derive by hand, rerun
// `db:backtest:h2h-market-signals-combined` if recalibration is ever needed.
export const H2H_MARKET_SIGNAL_DELTAS = {
  btts: 0.35,
  over25: 0.35,
  cleanSheetHome: 0.6,
  cleanSheetAway: 0.55,
  winToNilHome: 0.6,
  winToNilAway: 0.5,
} as const;

// Base shape reused by H2HMarketSignals (./h2h.ts, sampleSize added there) —
// kept here to avoid a circular import between the two files.
export type H2HMarketSignalInputs = {
  btts: number | null;
  over25: number | null;
  cleanSheetHome: number | null;
  cleanSheetAway: number | null;
  winToNilHome: number | null;
  winToNilAway: number | null;
};

const PROB_EPSILON = new Decimal("0.001");
const ONE = new Decimal(1);
const HALF = new Decimal("0.5");

function clampProb(value: Decimal): Decimal {
  return Decimal.min(Decimal.max(value, PROB_EPSILON), ONE.minus(PROB_EPSILON));
}

export function logit(p: Decimal): Decimal {
  const clamped = clampProb(p);
  return clamped.div(ONE.minus(clamped)).ln();
}

export function sigmoid(x: Decimal): Decimal {
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

// Applies the logit-shift to each of the 6 markets independently — a null
// signal (H2HService's own n>=3 gate) leaves that market's baseline
// probability untouched. BTTS/OVER25 complements (bttsNo/under25) are
// recomputed to stay a two-way split; CLEAN_SHEET/WIN_TO_NIL have no
// complement to maintain. Every other field on `probabilities` (1X2,
// combo markets, HT/FT, ...) passes through unchanged — none of them are
// derived from these 6 fields by formula (see markets.ts comments on
// resultBtts/resultTotalGoals: priced independently from bookmaker odds).
export function applyH2HMarketSignalCorrection<
  T extends H2HMarketSignalProbabilities,
>(probabilities: T, signals: H2HMarketSignalInputs): T {
  const bttsYes =
    signals.btts === null
      ? probabilities.bttsYes
      : shiftedProb(
          probabilities.bttsYes,
          signals.btts,
          H2H_MARKET_SIGNAL_DELTAS.btts,
        );
  const over25 =
    signals.over25 === null
      ? probabilities.over25
      : shiftedProb(
          probabilities.over25,
          signals.over25,
          H2H_MARKET_SIGNAL_DELTAS.over25,
        );
  const cleanSheetHome =
    signals.cleanSheetHome === null
      ? probabilities.cleanSheetHome
      : shiftedProb(
          probabilities.cleanSheetHome,
          signals.cleanSheetHome,
          H2H_MARKET_SIGNAL_DELTAS.cleanSheetHome,
        );
  const cleanSheetAway =
    signals.cleanSheetAway === null
      ? probabilities.cleanSheetAway
      : shiftedProb(
          probabilities.cleanSheetAway,
          signals.cleanSheetAway,
          H2H_MARKET_SIGNAL_DELTAS.cleanSheetAway,
        );
  const winToNilHome =
    signals.winToNilHome === null
      ? probabilities.winToNilHome
      : shiftedProb(
          probabilities.winToNilHome,
          signals.winToNilHome,
          H2H_MARKET_SIGNAL_DELTAS.winToNilHome,
        );
  const winToNilAway =
    signals.winToNilAway === null
      ? probabilities.winToNilAway
      : shiftedProb(
          probabilities.winToNilAway,
          signals.winToNilAway,
          H2H_MARKET_SIGNAL_DELTAS.winToNilAway,
        );

  return {
    ...probabilities,
    bttsYes,
    bttsNo: ONE.minus(bttsYes),
    over25,
    under25: ONE.minus(over25),
    cleanSheetHome,
    cleanSheetAway,
    winToNilHome,
    winToNilAway,
  };
}
