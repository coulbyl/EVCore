import type { TimeSlotKey } from "@/constants/time-slots";
import type { PredictionSource } from "@/types/dashboard";

// ---------------------------------------------------------------------------
// Fixture domain types — indépendants du concept "audit"
// ---------------------------------------------------------------------------

export type FixtureModelRun = {
  decision: "BET" | "NO_BET";
  deterministicScore: string;
  finalScore: string;
  market: string | null;
  pick: string | null;
  betStatus: "WON" | "LOST" | "PENDING" | null;
  probEstimated: string | null;
  ev: string | null;
  predictionSource: PredictionSource | null;
  lambdaHome: string | null;
  lambdaAway: string | null;
  expectedTotalGoals: string | null;
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
  modelRun: FixtureModelRun | null;
};

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export type FixtureDecisionFilter = "ALL" | "BET" | "NO_BET";
export type FixtureStatusFilter = "ALL" | "SCHEDULED" | "LIVE" | "FINISHED";
export type FixtureTimeSlotFilter = "ALL" | TimeSlotKey;
export type FixtureCompetitionFilter = "ALL" | string;

export type FixtureFilters = {
  date: string;
  competition: FixtureCompetitionFilter;
  decision: FixtureDecisionFilter;
  status: FixtureStatusFilter;
  timeSlot: FixtureTimeSlotFilter;
};
