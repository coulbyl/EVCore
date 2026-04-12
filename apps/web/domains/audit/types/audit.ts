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
  };
  leagueBreakdown: AuditLeagueRow[];
  betsByStatus: Array<{ status: string; count: number }>;
  betsByMarket: Array<{ market: string; count: number }>;
  settledBets: number;
  adjustmentProposals: number;
  activeSuspensions: number;
};
