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
