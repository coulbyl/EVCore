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

export type ChannelHealthItem = {
  channel: "VALUE" | "SAFE" | "DOMINANT" | "BTTS" | "DRAW" | "GOALS";
  status: ChannelStatus;
  primaryMetric: number;
  primaryMetricType: "ROI" | "HIT_RATE";
  roi: number | null;
  hitRate: number | null;
  vsThreshold: number | null;
  sampleSize: number;
};

export type ChannelStatsItem = {
  channel: "VALUE" | "SAFE" | "DOMINANT" | "BTTS" | "DRAW" | "GOALS";
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
