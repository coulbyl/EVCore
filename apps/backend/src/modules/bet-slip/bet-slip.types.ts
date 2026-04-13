export type BetSlipItemView = {
  betId: string;
  fixtureId: string;
  fixture: string;
  market: string;
  pick: string;
  odds: string | null;
  ev: string;
  stake: string;
  stakeOverride: string | null;
  createdAt: string;
  betStatus: 'WON' | 'LOST' | 'PENDING' | 'VOID';
  homeScore: number | null;
  awayScore: number | null;
  /** Gain net réel (>0) ou perte (<0) en unités de mise. null si le pari est encore en attente. */
  pnl: string | null;
};

export type BetSlipView = {
  id: string;
  userId: string;
  username: string;
  unitStake: string;
  itemCount: number;
  createdAt: string;
  items: BetSlipItemView[];
};

export type BetSlipSummaryView = {
  slipCount: number;
  wonBets: number;
  lostBets: number;
  pendingBets: number;
  settledBets: number;
  winRate: string;
  globalRoi: string | null;
  globalRoiBetCount: number;
};
