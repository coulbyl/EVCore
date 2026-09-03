export type KpiDelta = string | { bet: number; noBet: number };

export type PredictionSource =
  | "POISSON_MAIN"
  | "FRI_ELO_REAL"
  | "FRI_ELO_INTERNAL"
  | "ODDS_DEVIG";

export type KpiCard = {
  label: string;
  value: string;
  delta: KpiDelta;
  tone: "accent" | "success" | "warning" | "danger" | "neutral";
};

export type WorkerStatus = {
  worker: string;
  lastRun: string;
  status: "healthy" | "watch" | "late";
  detail: string;
};

export type AlertItem = {
  id: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
};

export type PnlSummary = {
  settledBets: number;
  wonBets: number;
  winRate: string;
  netUnits: string;
  roi: string;
};

export type DashboardSummary = {
  dashboardKpis: KpiCard[];
  workerStatuses: WorkerStatus[];
  activeAlerts: AlertItem[];
  pnlSummary: PnlSummary;
};

export type CompetitionStat = {
  competitionId: string;
  competitionName: string;
  competitionCode: string;
  activeFixtures: number;
  model: {
    settled: number;
    won: number;
    roi: string | null;
    winRate: string | null;
  };
  myPicks: {
    settled: number;
    won: number;
    roi: string | null;
  } | null;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  roi: string;
  settled: number;
  won: number;
};

export type ChannelStatus =
  | "GREEN"
  | "ORANGE"
  | "RED"
  | "INACTIVE"
  | "INSUFFICIENT_DATA";

// Canal suivi côté Track Record. Reprend la liste des canaux plutôt que de la
// réénumérer : une union écrite à la main ne se met pas à jour, et c'est ce
// qui avait laissé 8 canaux hors de la page de performance (voir
// TRACKED_CHANNELS côté backend).
export type TrackedChannel =
  | "VALUE"
  | "SAFE"
  | "DOMINANT"
  | "BTTS"
  | "DRAW"
  | "GOALS"
  | "CLEAN_SHEET"
  | "TEAM_TOTAL"
  | "FIRST_HALF"
  | "DOUBLE_CHANCE"
  | "RESULT_TOTAL_GOALS"
  | "OVER_UNDER_HT"
  | "RESULT_BTTS"
  | "DRAW_NO_BET"
  | "WIN_TO_NIL"
  | "HALF_TIME_FULL_TIME"
  | "WIN_EITHER_HALF"
  | "CORRECT_SCORE"
  | "VANTAGE";

export type ChannelHealthItem = {
  channel: TrackedChannel;
  status: ChannelStatus;
  primaryMetric: number;
  primaryMetricType: "ROI" | "HIT_RATE";
  roi: number | null;
  hitRate: number | null;
  /** Réel/annoncé — drives `status`, never `roi` (see backend dashboard.types.ts). */
  calibrationRatio: number | null;
  vsThreshold: number | null;
  sampleSize: number;
};

export type ChannelStatsItem = {
  channel: TrackedChannel;
  hitRate: number | null;
  avgThreshold: number | null;
  vsThreshold: number | null;
  roi: number | null;
  netUnits: number | null;
  maxDrawdown: number | null;
  sampleSize: number;
  oddsAvailabilityRate: number;
  trend: "UP" | "FLAT" | "DOWN";
};

/** One (channel × competition) row — see backend dashboard.types.ts for the
 * full rationale. Independent tracking section on the track-record page. */
export type ChannelCompetitionStatItem = {
  channel: ChannelStatsItem["channel"];
  competitionCode: string;
  competitionName: string;
  competitionCountry: string;
  roi: number | null;
  hitRate: number | null;
  calibrationRatio: number | null;
  sampleSize: number;
  status: ChannelStatus;
};
