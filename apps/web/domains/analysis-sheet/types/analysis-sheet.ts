export type AnalysisSheetChannel =
  | "VALUE"
  | "SAFE"
  | "DOMINANT"
  | "BTTS"
  | "DRAW"
  | "GOALS";

export type AnalysisSheetFilters = {
  from: string;
  to: string;
  competitionCode?: string;
  channel?: AnalysisSheetChannel;
};

// One earlier rolling-horizon pass where this channel also had a SELECTED
// pick — oldest first (line-movement trail).
export type AnalysisSheetPickHistoryEntry = {
  analyzedAt: string;
  phase: string;
  market: string;
  pick: string;
  probability: number;
  odds: number | null;
  ev: number;
};

export type AnalysisSheetJsonPick = {
  channel: string;
  market: string;
  pick: string;
  comboMarket: string | null;
  comboPick: string | null;
  probability: number;
  odds: number | null;
  ev: number;
  qualityScore: number | null;
  rank: number;
  result: string | null;
  history: AnalysisSheetPickHistoryEntry[];
};

// Fixture-level AVOID flag (meta-channel, no pick of its own).
export type AnalysisSheetAvoidFlag = {
  reasonCode: string | null;
  maxEdge: number | null;
  offenders: {
    channel: string;
    market: string;
    pick: string;
    edge: number;
  }[];
};

// Fixture-level calibration alert (model↔market coherence gate).
export type AnalysisSheetCalibrationAlert = {
  reasons: string[];
  modelFavorite: string;
  marketFavorite: string;
  modelProbability: number;
  medianImplied: number;
  divergence: number;
  bookmakerCount: number;
};

export type AnalysisSheetRejectionSummary = {
  channel: string;
  status: string;
  count: number;
  topReasonCode: string | null;
};

export type AnalysisSheetJsonFixture = {
  fixtureId: string;
  match: string;
  competition: string;
  kickoff: string;
  status: string;
  score: string | null;
  model: {
    deterministicScore: number;
    finalScore: number;
    scoreThreshold: number;
    predictionSource: string | null;
    lambda: { home: number; away: number; total: number } | null;
    shadowSignals: {
      lineMovement: number | null;
      h2h: number | null;
      congestion: number | null;
    } | null;
    shadowPredictions: {
      winnerName: string | null;
      percent: { home: number; draw: number; away: number };
      poisson: { home: number; away: number };
      conflict: boolean;
    } | null;
  };
  avoidFlag: AnalysisSheetAvoidFlag | null;
  calibrationAlert: AnalysisSheetCalibrationAlert | null;
  selectedPicks: AnalysisSheetJsonPick[];
  rejectionSummary: AnalysisSheetRejectionSummary[];
};

export type AnalysisSheetJson = {
  generatedAt: string;
  range: { from: string; to: string };
  filters: { competitionCode: string | null; channel: string | null };
  summary: {
    fixtureCount: number;
    avoidedFixtureCount: number;
    calibrationAlertCount: number;
    byCompetition: Record<string, number>;
    byChannel: Record<string, number>;
    settledRecord: { won: number; lost: number; pending: number; void: number };
  };
  fixtures: AnalysisSheetJsonFixture[];
};

export type AnalyzeWithEvaResult = {
  analysis: string;
  sheetSummary: AnalysisSheetJson["summary"];
  model: string;
  generatedAt: string;
  truncated: boolean;
};
