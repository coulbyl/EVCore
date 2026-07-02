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
  };
  selectedPicks: AnalysisSheetJsonPick[];
  rejectionSummary: AnalysisSheetRejectionSummary[];
};

export type AnalysisSheetJson = {
  generatedAt: string;
  range: { from: string; to: string };
  filters: { competitionCode: string | null; channel: string | null };
  summary: {
    fixtureCount: number;
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
