import type { PredictionSource } from "@/domains/dashboard/types/dashboard";

// ---------------------------------------------------------------------------
// Fixture domain types — indépendants du concept "audit"
// ---------------------------------------------------------------------------

export type FixtureModelFactors = {
  recentForm: number | null;
  xg: number | null;
  performanceDomExt: number | null;
  volatiliteLigue: number | null;
};

export type FixtureModelRun = {
  modelRunId: string;
  deterministicScore: string;
  finalScore: string;
  betId: string | null;
  market: string | null;
  pick: string | null;
  comboMarket: string | null;
  comboPick: string | null;
  betStatus: "WON" | "LOST" | "PENDING" | null;
  probEstimated: string | null;
  ev: string | null;
  predictionSource: PredictionSource | null;
  lambdaHome: string | null;
  lambdaAway: string | null;
  expectedTotalGoals: string | null;
  candidatePicks: FixturePickSnapshot[];
  evaluatedPicks: FixtureEvaluatedPickSnapshot[];
  factors: FixtureModelFactors | null;
};

export type FixturePickSnapshot = {
  market: string;
  pick: string;
  comboMarket?: string;
  comboPick?: string;
  probability: string;
  odds: string;
  ev: string;
  qualityScore: string;
};

export type FixtureEvaluatedPickSnapshot = FixturePickSnapshot & {
  status: "viable" | "rejected";
  rejectionReason?: string;
};

export type FixturePrediction = {
  channel: "CONF" | "DRAW" | "BTTS";
  market: string;
  pick: string;
  probability: string;
  correct: boolean | null;
  odds: string | null;
};

export type FixtureSvBet = {
  betId: string;
  market: string;
  pick: string;
  comboMarket: string | null;
  comboPick: string | null;
  ev: string;
  odds: string | null;
  betStatus: "WON" | "LOST" | "PENDING" | null;
  probEstimated: string | null;
};

export type FixtureRow = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  country: string;
  competitionCode: string;
  scheduledAt: string;
  status: string;
  score: string | null;
  htScore: string | null;
  alreadyInUserTicket: boolean;
  modelRun: FixtureModelRun | null;
  safeValueBet: FixtureSvBet | null;
  prediction: FixturePrediction | null;
  drawPrediction: FixturePrediction | null;
  bttsPrediction: FixturePrediction | null;
};

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export type FixtureFilters = {
  date: string;
};
