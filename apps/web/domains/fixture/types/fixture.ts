import type { TimeSlotKey } from "@/constants/time-slots";
import type { PredictionSource } from "@/domains/dashboard/types/dashboard";

// ---------------------------------------------------------------------------
// Fixture domain types — indépendants du concept "audit"
// ---------------------------------------------------------------------------

export type FixtureModelRun = {
  modelRunId: string;
  decision: "BET" | "NO_BET";
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

export type FixtureRow = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  competitionCode: string;
  scheduledAt: string;
  status: string;
  score: string | null;
  htScore: string | null;
  hasOdds: boolean;
  alreadyInUserTicket: boolean;
  modelRun: FixtureModelRun | null;
};

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export type FixtureDecisionFilter = "ALL" | "BET" | "NO_BET";
export type FixtureStatusFilter = "ALL" | "SCHEDULED" | "LIVE" | "FINISHED";
export type FixtureTimeSlotFilter = "ALL" | TimeSlotKey;
export type FixtureCompetitionFilter = "ALL" | string;
export type FixtureBetStatusFilter = "ALL" | "WON" | "LOST" | "PENDING";

export type FixtureFilters = {
  date: string;
  competition: FixtureCompetitionFilter;
  decision: FixtureDecisionFilter;
  status: FixtureStatusFilter;
  timeSlot: FixtureTimeSlotFilter;
  betStatus: FixtureBetStatusFilter;
};
