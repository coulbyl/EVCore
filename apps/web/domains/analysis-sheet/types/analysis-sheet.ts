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
  // Net win the user wants Eva's coupon stakes sized for (analyze flow only —
  // never sent on exports).
  targetWinAmount?: number;
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
  probability: number;
  odds: number | null;
  ev: number;
  qualityScore: number | null;
  rank: number;
  result: string | null;
  // CORRECT_SCORE picks are prediction-only, never staked.
  observationOnly: boolean;
  history: AnalysisSheetPickHistoryEntry[];
  // probability − rawPoissonProbability for this (market, pick); null when
  // not covered by the raw-probability export.
  adjustmentDelta: number | null;
  // ev − EV_THRESHOLD: margin above the coupon-eligibility EV floor.
  evMarginToThreshold: number;
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
    // Share of the 3 shadow signals populated (0-1) — distinct from finalScore.
    dataCoverage: number;
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
    settledRecord: {
      playable: SettledRecordBucket;
      observation: SettledRecordBucket;
    };
  };
  fixtures: AnalysisSheetJsonFixture[];
};

type SettledRecordBucket = {
  won: number;
  lost: number;
  pending: number;
  void: number;
};

// One coupon leg, fully resolved and priced by the backend from the sheet —
// the LLM only names fixtureId + channel, never numbers.
export type EvaCouponLeg = {
  fixtureId: string;
  match: string;
  competition: string;
  kickoff: string;
  channel: string;
  market: string;
  pick: string;
  pickLabel: string;
  probability: number;
  odds: number;
  ev: number;
};

export type EvaCoupon = {
  label: string;
  legs: EvaCouponLeg[];
  totalOdds: number;
  // Null when the user gave no target win amount.
  stake: number | null;
  potentialPayout: number | null;
  netGain: number | null;
};

export type DroppedEvaCoupon = {
  label: string;
  reasonCode: string;
};

export type AnalyzeWithEvaResult = {
  analysis: string;
  coupons: EvaCoupon[];
  droppedCoupons: DroppedEvaCoupon[];
  targetWinAmount: number | null;
  sheetSummary: AnalysisSheetJson["summary"];
  model: string;
  generatedAt: string;
  truncated: boolean;
};
