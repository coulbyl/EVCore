export type KpiDelta = string | { bet: number; noBet: number };

export type KpiCard = {
  label: string;
  value: string;
  delta: KpiDelta;
  tone: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
};

export type WorkerStatus = {
  worker: string;
  lastRun: string;
  status: 'healthy' | 'watch' | 'late';
  detail: string;
};

export type AlertItem = {
  id: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
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

export type CompetitionModelStats = {
  settled: number;
  won: number;
  /** null si settled < 10 (données insuffisantes) */
  roi: string | null;
  /** null si settled < 10 */
  winRate: string | null;
};

export type CompetitionMyPicks = {
  settled: number;
  won: number;
  /** null si settled < 5 */
  roi: string | null;
};

export type CompetitionStat = {
  competitionId: string;
  competitionName: string;
  competitionCode: string;
  activeFixtures: number;
  model: CompetitionModelStats;
  /** null si l'utilisateur n'a aucun pick settlé dans cette compétition */
  myPicks: CompetitionMyPicks | null;
};

export type PnlByCanalResponse = {
  from: string;
  to: string;
  global: PnlSummary;
  value: PnlSummary;
  safe: PnlSummary;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  /** ROI formaté ex. "+12.3%" */
  roi: string;
  settled: number;
  won: number;
};

export type ChannelStatus =
  | 'GREEN'
  | 'ORANGE'
  | 'RED'
  | 'INACTIVE'
  | 'INSUFFICIENT_DATA';

export type ChannelHealthItem = {
  channel: 'VALUE' | 'SAFE' | 'DOMINANT' | 'BTTS' | 'DRAW' | 'GOALS';
  status: ChannelStatus;
  primaryMetric: number;
  primaryMetricType: 'ROI' | 'HIT_RATE';
  roi: number | null;
  hitRate: number | null;
  vsThreshold: number | null;
  sampleSize: number;
};

export type ChannelStatsItem = {
  channel: 'VALUE' | 'SAFE' | 'DOMINANT' | 'BTTS' | 'DRAW' | 'GOALS';
  hitRate: number | null;
  avgThreshold: number | null;
  vsThreshold: number | null;
  roi: number | null;
  netUnits: number | null;
  maxDrawdown: number | null;
  sampleSize: number;
  oddsAvailabilityRate: number;
  trend: 'UP' | 'FLAT' | 'DOWN';
};
