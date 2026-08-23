import type Decimal from "decimal.js";
import type { Market } from "../types";

// League/market tuning injected by the host app into the pure selection core.
//
// The core owns the selection *algorithm*; the per-league and per-(market,pick)
// override *values* are app-side data (see ev.constants) — they may eventually
// be env- or DB-driven. The app resolves them for a given competitionCode and
// hands the core this plain config, keeping the core free of any league table.
//
// Scalars are pre-resolved for the fixture's competition; the per-(market,pick)
// resolvers stay as functions because they vary across the picks of one fixture.
export type SelectionConfig = {
  // Per-league EV floor (the canonical >= 0.08 default lives app-side).
  leagueEvThreshold: Decimal;
  // Per-league minimum model edge (probability − 1/odds) for VALUE picks. Falls
  // back to VALUE_MIN_EDGE when undefined. Set unreachably high (≥ 1) to suspend
  // VALUE for a league whose model carries no real edge even at high claimed edge.
  valueMinEdge?: Decimal;
  // Safe-value per-league floors.
  svMinProbability: Decimal;
  svMinOdds: Decimal;
  // Whether this league has the HT/FT history to allow HALF_TIME_FULL_TIME /
  // FIRST_HALF_WINNER markets.
  htftCalibrated: boolean;
  // Minimum directional probability for 1X2 HOME/AWAY (and DRAW combos).
  pickDirectionProbabilityThreshold(market: Market, pick: string): Decimal;
  // Per-(market, pick) EV floor — `leagueFloor` is the effective league EV
  // threshold for the fixture (override or leagueEvThreshold).
  pickEvFloor(market: Market, pick: string, leagueFloor: Decimal): Decimal;
  // Per-(market, pick) EV soft cap.
  pickEvSoftCap(market: Market, pick: string): Decimal;
  // Per-(market, pick) odds floor.
  pickMinSelectionOdds(market: Market, pick: string): Decimal;
  // Per-(market, pick) odds ceiling; null falls back to the global cap.
  pickMaxSelectionOdds(market: Market, pick: string): Decimal | null;
  // Cross-market ranking discount for VALUE (2026-08-19, db:backtest:
  // market-trust-calibration) — VALUE compares candidates from 17 markets
  // of very different calibration reliability; ranking on raw qualityScore
  // lets the worst-calibrated market win by having the largest noise, not
  // the best real pick (winner's curse). Walk-forward validated: +0.86pp
  // ROI on the held-out test window vs unweighted. Optional: undefined ⇒
  // trust=1 (identity) for every market — matches VALUE's pre-2026-08-19
  // behavior, so existing callers that haven't wired this still work
  // unchanged.
  valueMarketTrust?(market: Market): Decimal;
  // Same idea for SAFE (widened from 4 to all 17 markets on 2026-08-19,
  // same day) — kept as a SEPARATE resolver, not shared with valueMarketTrust:
  // the weights measured on VALUE's edge≥0.10 population regressed SAFE's
  // own (much narrower, high-probability) population by -0.28pp out-of-
  // sample; a SAFE-specific measurement only got to -0.04pp (noise-level,
  // not a validated improvement — db:backtest:market-trust-calibration
  // report, 2026-08-19). No app-side implementation ships this yet
  // (getMarketTrust in ev.constants.ts only feeds valueMarketTrust); revisit
  // once the newer markets (WIN_TO_NIL/CLEAN_SHEET/etc., ~1 month old)
  // accumulate enough SAFE-eligible volume for a real measurement.
  safeMarketTrust?(market: Market): Decimal;
};
