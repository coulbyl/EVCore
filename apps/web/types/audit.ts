export type AuditFixtureRow = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  competitionCode: string;
  scheduledAt: string;
  status: string;
  hasOdds: boolean;
  modelRun: {
    decision: "BET" | "NO_BET";
    deterministicScore: string;
    finalScore: string;
    market: string | null;
    pick: string | null;
    ev: string | null;
  } | null;
};

export type AuditLeagueRow = {
  code: string;
  name: string;
  isActive: boolean;
  fixtures: number;
  finished: number;
  withXg: number;
  withOdds: number;
  teamStats: number;
  xgCoveragePct: number;
};

export type AuditOverview = {
  generatedAt: string;
  counts: {
    fixtures: number;
    modelRuns: number;
    bets: number;
    coupons: number;
  };
  leagueBreakdown: AuditLeagueRow[];
  betsByStatus: Array<{ status: string; count: number }>;
  betsByMarket: Array<{ market: string; count: number }>;
  couponsByStatus: Array<{ status: string; count: number }>;
  settledBets: number;
  adjustmentProposals: number;
  activeSuspensions: number;
};
