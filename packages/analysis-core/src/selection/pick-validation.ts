import Decimal from "decimal.js";
import { Market } from "../types";
import {
  EV_HARD_CAP,
  EV_MIN_PROBABILITY_THRESHOLD,
  MAX_SELECTION_ODDS,
  MIN_DRAW_DIRECTION_PROBABILITY,
  MIN_QUALITY_SCORE,
  ONE_X_TWO_AWAY_LONGSHOT_PENALTY_FLOOR,
  ONE_X_TWO_AWAY_MAX_ODDS,
  ONE_X_TWO_DRAW_LONGSHOT_PENALTY_FLOOR,
  ONE_X_TWO_DRAW_MAX_ODDS,
  ONE_X_TWO_LONGSHOT_PENALTY_EXPONENT,
  UNDER_HIGH_LAMBDA_THRESHOLD,
} from "./constants";
import type { SelectionConfig } from "./config";
import type { EvaluatedPick, MatchProbabilities, ViablePick } from "./types";

export function getPickRejectionReason(
  pick: ViablePick,
  suspendedMarkets: ReadonlySet<Market>,
  probabilities: MatchProbabilities,
  config: SelectionConfig,
  minEv: Decimal,
  lambdaTotal = 0,
): EvaluatedPick["rejectionReason"] {
  const minDirectionProbability = config.pickDirectionProbabilityThreshold(
    pick.market,
    pick.pick,
  );

  if (pick.ev.greaterThan(EV_HARD_CAP)) {
    return "ev_above_hard_cap";
  }

  // HT/FT markets require calibrated leagues — secondary leagues lack the
  // half-time decomposition history to avoid bivariate Poisson overestimation.
  if (
    (pick.market === Market.HALF_TIME_FULL_TIME ||
      pick.market === Market.FIRST_HALF_WINNER) &&
    !config.htftCalibrated
  ) {
    return "market_suspended";
  }

  // Under-2.5 bets at high expected-goal totals: the independent Poisson model
  // overestimates P(Under) due to real-match overdispersion. Reject outright when
  // λ ≥ 2.3 — lowered from 2.5 after May 2026 live diagnostic (losses at λ 2.30–2.80).
  if (
    pick.market === Market.OVER_UNDER &&
    pick.pick === "UNDER" &&
    lambdaTotal >= UNDER_HIGH_LAMBDA_THRESHOLD
  ) {
    return "under_high_lambda";
  }

  // Minimum probability floor for all markets — picks below 40% are empirically
  // losing even with positive EV (model overestimates edge on low-P candidates).
  if (pick.probability.lessThan(EV_MIN_PROBABILITY_THRESHOLD)) {
    return "probability_too_low";
  }

  if (pick.market === Market.ONE_X_TWO) {
    if (
      pick.pick === "HOME" &&
      probabilities.home.lessThan(minDirectionProbability)
    ) {
      return "probability_too_low";
    }
    if (
      pick.pick === "AWAY" &&
      probabilities.away.lessThan(minDirectionProbability)
    ) {
      return "probability_too_low";
    }
    // Combo picks with DRAW as primary leg (e.g. NUL + MOINS 2.5) passed the EV
    // floor via high combo odds while P(draw) was 19-27% — audit 2026-03-28: 0/3.
    // Require a minimum draw probability before accepting DRAW-based combos.
    if (
      pick.pick === "DRAW" &&
      pick.isCombo &&
      probabilities.draw.lessThan(MIN_DRAW_DIRECTION_PROBABILITY)
    ) {
      return "probability_too_low";
    }
  }

  if (pick.ev.lessThan(config.pickEvFloor(pick.market, pick.pick, minEv))) {
    return "ev_below_threshold";
  }

  const evSoftCap = config.pickEvSoftCap(pick.market, pick.pick);
  if (pick.ev.greaterThan(evSoftCap)) {
    return "ev_above_soft_cap";
  }

  if (pick.qualityScore.lessThan(MIN_QUALITY_SCORE)) {
    return "quality_score_below_threshold";
  }

  const minSelectionOdds = config.pickMinSelectionOdds(pick.market, pick.pick);

  if (pick.odds.lessThan(minSelectionOdds)) {
    return "odds_below_floor";
  }

  // Per-pick odds ceiling — when defined, it REPLACES the global MAX_SELECTION_ODDS
  // cap. This allows both tighter windows (e.g. SP2 HOME < 1.95) and wider ones
  // (e.g. PL DRAW up to 5.50) without touching the global default.
  const maxSelectionOdds = config.pickMaxSelectionOdds(pick.market, pick.pick);
  if (maxSelectionOdds !== null) {
    if (pick.odds.greaterThan(maxSelectionOdds)) {
      return "odds_above_cap";
    }
  } else if (!pick.isCombo && pick.odds.greaterThan(MAX_SELECTION_ODDS)) {
    // For combos, individual leg odds are already filtered upstream — only apply
    // the cap to single picks where the pick odds IS the leg odds.
    return "odds_above_cap";
  }

  if (
    suspendedMarkets.has(pick.market) ||
    (pick.comboMarket !== undefined && suspendedMarkets.has(pick.comboMarket))
  ) {
    return "market_suspended";
  }

  return undefined;
}

export function buildQualityScore(
  ev: Decimal,
  deterministicScore: Decimal,
  market: Market,
  pick: string,
  odds?: Decimal,
): Decimal {
  return ev
    .mul(deterministicScore)
    .mul(getOneXTwoLongshotPenalty(market, pick, odds ?? new Decimal(0)));
}

function getOneXTwoLongshotPenalty(
  market: Market,
  pick: string,
  odds: Decimal,
): Decimal {
  if (market !== Market.ONE_X_TWO) {
    return new Decimal(1);
  }

  if (pick === "AWAY" && odds.greaterThanOrEqualTo(ONE_X_TWO_AWAY_MAX_ODDS)) {
    return progressiveLongshotPenalty({
      threshold: ONE_X_TWO_AWAY_MAX_ODDS,
      odds,
      floor: ONE_X_TWO_AWAY_LONGSHOT_PENALTY_FLOOR,
    });
  }

  if (pick === "DRAW" && odds.greaterThanOrEqualTo(ONE_X_TWO_DRAW_MAX_ODDS)) {
    return progressiveLongshotPenalty({
      threshold: ONE_X_TWO_DRAW_MAX_ODDS,
      odds,
      floor: ONE_X_TWO_DRAW_LONGSHOT_PENALTY_FLOOR,
    });
  }

  return new Decimal(1);
}

function progressiveLongshotPenalty(input: {
  threshold: Decimal;
  odds: Decimal;
  floor: Decimal;
}): Decimal {
  const { threshold, odds, floor } = input;
  if (odds.lte(0)) {
    return floor;
  }

  const ratio = threshold.div(odds);
  const progressive = ratio.pow(ONE_X_TWO_LONGSHOT_PENALTY_EXPONENT);
  return Decimal.max(floor, Decimal.min(new Decimal(1), progressive));
}
