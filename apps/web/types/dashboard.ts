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

export type CouponTier = "PREMIUM" | "STANDARD" | "SPECULATIF";

export type CouponSnapshot = {
  id: string;
  code: string;
  status: "PENDING" | "WON" | "LOST";
  tier: CouponTier | null;
  legs: number;
  ev: string;
  window: string;
  selections: Array<{
    id: string;
    fixtureId?: string;
    fixture: string;
    homeLogo: string | null;
    awayLogo: string | null;
    scheduledAt: string;
    fixtureStatus: string;
    score: string | null;
    htScore?: string | null;
    status: "PENDING" | "WON" | "LOST" | "VOID";
    market: string;
    pick: string;
    odds: string;
    ev: string;
    // Diagnostic fields (populated by GET /coupon/:id)
    probEstimated?: string;
    predictionSource?: PredictionSource | null;
    lambdaHome?: string | null;
    lambdaAway?: string | null;
    expectedTotalGoals?: string | null;
    candidatePicks?: Array<{
      market: string;
      pick: string;
      comboMarket?: string;
      comboPick?: string;
      probability: string;
      odds: string;
      ev: string;
      qualityScore: string;
    }>;
    evaluatedPicks?: Array<{
      market: string;
      pick: string;
      comboMarket?: string;
      comboPick?: string;
      probability: string;
      odds: string;
      ev: string;
      qualityScore: string;
      status: "viable" | "rejected";
      rejectionReason?: string;
    }>;
  }>;
};

export type OpportunityRow = {
  id: string;
  couponId: string | null;
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
  couponSnapshots: CouponSnapshot[];
  topOpportunities: OpportunityRow[];
  selectedFixture: FixturePanel;
  activityFeed: ActivityItem[];
  pnlSummary: PnlSummary;
};

export type CouponPeriodResponse = {
  period: {
    from: string;
    to: string;
  };
  coupons: CouponSnapshot[];
};
