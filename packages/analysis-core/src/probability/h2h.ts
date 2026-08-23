import Decimal from "decimal.js";
import type { H2HMarketSignalInputs } from "./h2h-market-signal-correction";

// Pure H2H computations — extracted 2026-08-18 from apps/backend's
// H2HService so the backtest harness (@evcore/backtest-core) replays the
// exact same H2H signals as the live engine. Fetching the legs (point-in-
// time-safe: `scheduledAt < fixtureDate`) stays app-side —
// H2HService.fetchLegs in the live engine, PointInTimeLoader.loadH2HLegs in
// the harness — because that's the only part that touches a database.

export type H2HLeg = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

export const H2H_LIMIT_DEFAULT = 5;
// n<3 is as "confident" as n=5, so gate it like TeamStats cold-start.
export const H2H_MIN_SAMPLE = 3;
// Same decay convention as recentForm (rolling-stats.utils.ts) — most
// recent match weighted heaviest.
export const H2H_DECAY = new Decimal("0.8");
export const H2H_DRAW_SCORE = new Decimal("0.5");

export type H2HMarketSignals = H2HMarketSignalInputs & {
  sampleSize: number;
};

export type H2HScorelineSignal = {
  scoreline: string | null;
  confidence: number | null;
  sampleSize: number;
};

function weightedRate(
  legs: readonly H2HLeg[],
  indicator: (leg: H2HLeg) => Decimal,
): number {
  let weightedSum = new Decimal(0);
  let weightTotal = new Decimal(0);
  legs.forEach((leg, i) => {
    const weight = H2H_DECAY.pow(i);
    weightedSum = weightedSum.plus(weight.times(indicator(leg)));
    weightTotal = weightTotal.plus(weight);
  });
  return weightedSum.div(weightTotal).toNumber();
}

// "Clean sheet for teamId in this leg" — teamId's opponent scored 0,
// regardless of which side (home/away) teamId occupied in that past leg.
function teamCleanSheetInLeg(leg: H2HLeg, teamId: string): Decimal {
  const kept =
    leg.homeTeamId === teamId ? leg.awayScore === 0 : leg.homeScore === 0;
  return new Decimal(kept ? 1 : 0);
}

function teamWinToNilInLeg(leg: H2HLeg, teamId: string): Decimal {
  const won =
    leg.homeTeamId === teamId
      ? leg.homeScore > leg.awayScore && leg.awayScore === 0
      : leg.awayScore > leg.homeScore && leg.homeScore === 0;
  return new Decimal(won ? 1 : 0);
}

// Decay-weighted rate at which `favoriteTeamId` has won this head-to-head,
// draws scored as H2H_DRAW_SCORE. Feeds adjustLambdaForH2H's lambda
// correction. Null below H2H_MIN_SAMPLE legs.
export function computeH2HScoreFromLegs(
  legs: readonly H2HLeg[],
  favoriteTeamId: string,
): number | null {
  if (legs.length < H2H_MIN_SAMPLE) return null;

  let weightedSum = new Decimal(0);
  let weightTotal = new Decimal(0);
  legs.forEach((leg, i) => {
    const weight = H2H_DECAY.pow(i);
    const winnerTeamId =
      leg.homeScore > leg.awayScore
        ? leg.homeTeamId
        : leg.awayScore > leg.homeScore
          ? leg.awayTeamId
          : null;
    const outcomeScore =
      winnerTeamId === null
        ? H2H_DRAW_SCORE
        : new Decimal(winnerTeamId === favoriteTeamId ? 1 : 0);

    weightedSum = weightedSum.plus(weight.times(outcomeScore));
    weightTotal = weightTotal.plus(weight);
  });

  return weightedSum.div(weightTotal).toNumber();
}

// Per-market H2H rates (BTTS/Over 2.5/Clean Sheet/Win to Nil) feeding
// applyH2HMarketSignalCorrection. Shadow only — see H2H_MARKET_SIGNAL_DELTAS.
export function computeH2HMarketSignalsFromLegs(
  legs: readonly H2HLeg[],
  input: { homeTeamId: string; awayTeamId: string },
): H2HMarketSignals {
  const { homeTeamId, awayTeamId } = input;

  if (legs.length < H2H_MIN_SAMPLE) {
    return {
      btts: null,
      over25: null,
      cleanSheetHome: null,
      cleanSheetAway: null,
      winToNilHome: null,
      winToNilAway: null,
      sampleSize: legs.length,
    };
  }

  return {
    btts: weightedRate(
      legs,
      (leg) => new Decimal(leg.homeScore > 0 && leg.awayScore > 0 ? 1 : 0),
    ),
    over25: weightedRate(
      legs,
      (leg) => new Decimal(leg.homeScore + leg.awayScore >= 3 ? 1 : 0),
    ),
    cleanSheetHome: weightedRate(legs, (leg) =>
      teamCleanSheetInLeg(leg, homeTeamId),
    ),
    cleanSheetAway: weightedRate(legs, (leg) =>
      teamCleanSheetInLeg(leg, awayTeamId),
    ),
    winToNilHome: weightedRate(legs, (leg) =>
      teamWinToNilInLeg(leg, homeTeamId),
    ),
    winToNilAway: weightedRate(legs, (leg) =>
      teamWinToNilInLeg(leg, awayTeamId),
    ),
    sampleSize: legs.length,
  };
}

// Decay-weighted most-frequent H2H scoreline, oriented to the target
// fixture's home/away sides. Shadow only (CORRECT_SCORE reasonDetails) —
// see memory project-correct-score-immature.
export function computeH2HScorelineSignalFromLegs(
  legs: readonly H2HLeg[],
  input: { homeTeamId: string },
): H2HScorelineSignal {
  const { homeTeamId } = input;

  if (legs.length < H2H_MIN_SAMPLE) {
    return { scoreline: null, confidence: null, sampleSize: legs.length };
  }

  const weights = new Map<string, Decimal>();
  let weightTotal = new Decimal(0);
  legs.forEach((leg, i) => {
    const weight = H2H_DECAY.pow(i);
    // Orient the past leg's score to the target fixture's home/away sides —
    // a leg where today's home team played away still counts, flipped.
    const [orientedHome, orientedAway] =
      leg.homeTeamId === homeTeamId
        ? [leg.homeScore, leg.awayScore]
        : [leg.awayScore, leg.homeScore];
    const key = `${orientedHome}:${orientedAway}`;
    weights.set(key, (weights.get(key) ?? new Decimal(0)).plus(weight));
    weightTotal = weightTotal.plus(weight);
  });

  let topScoreline: string | null = null;
  let topWeight = new Decimal(-1);
  for (const [scoreline, weight] of weights) {
    if (weight.greaterThan(topWeight)) {
      topScoreline = scoreline;
      topWeight = weight;
    }
  }

  return {
    scoreline: topScoreline,
    confidence: topWeight.div(weightTotal).toNumber(),
    sampleSize: legs.length,
  };
}
