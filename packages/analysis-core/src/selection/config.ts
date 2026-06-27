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
};
