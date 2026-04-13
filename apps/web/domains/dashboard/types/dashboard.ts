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

export type OpportunityRow = {
  id: string;
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  kickoff: string;
  fixtureStatus: string;
  market: string;
  pick: string;
  odds: string;
  ev: string;
  quality: string;
  deterministic: string;
  decision: "BET" | "NO_BET";
};

export type FixturePanel = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  startTime: string;
  market: string;
  pick: string;
  modelConfidence: string;
  notes: string[];
  metrics: Array<{
    label: string;
    value: string;
    tone?: "accent" | "success" | "warning" | "danger" | "neutral";
  }>;
};

export type ActivityItem = {
  time: string;
  level: "INFO" | "WARN" | "BET" | "ALERT";
  message: string;
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
  topOpportunities: OpportunityRow[];
  selectedFixture: FixturePanel;
  activityFeed: ActivityItem[];
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
