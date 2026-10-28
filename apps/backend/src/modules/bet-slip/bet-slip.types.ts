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
  canal: 'VALUE' | 'SAFE';
  homeTeam: string;
  awayTeam: string;
};

/** Résultat en francs du coupon, calculé une fois (`slipMoney`). */
export type BetSlipResultView = {
  status: 'WON' | 'LOST' | 'VOID' | 'PENDING';
  staked: string;
  settledStake: string;
  returned: string;
  net: string;
  pendingStake: string;
  potentialReturn: string;
};

export type BetSlipView = {
  id: string;
  userId: string;
  username: string;
  unitStake: string;
  type: 'SIMPLE' | 'COMBO';
  itemCount: number;
  createdAt: string;
  items: BetSlipItemView[];
  /** Cote d'un combiné au moment du jeu (produit des jambes), sinon null. */
  totalOdds: string | null;
  /** Supprimable : aucune jambe réglée et aucun match commencé. */
  deletable: boolean;
  result: BetSlipResultView;
};

export type BetSlipSummaryView = {
  slipCount: number;
  wonBets: number;
  lostBets: number;
  pendingBets: number;
  settledBets: number;
  winRate: string;
  /**
   * Résultat du joueur à mise fixe, une unité par pari joué (une jambe d'un
   * coupon simple, un coupon combiné entier). Remplace `globalRoi`, qui
   * lisait le ROI des paris internes VALUE de tous les utilisateurs dans la
   * table `bet` (plus alimentée depuis le 2026-09-04), pas celui du joueur.
   */
  plays: {
    won: number;
    lost: number;
    void: number;
    pending: number;
    settled: number;
    /** Gain net en unités, signé, deux décimales (« -0.42 »). */
    profitUnits: string;
    /** Gain net / paris réglés (« -0.0410 »), null sans pari réglé. */
    returnRate: string | null;
  };
  /**
   * Résultat en francs, mises déclarées, même règle que le solde : misé et
   * rendu sur les coupons réglés, mises encore en jeu, date du premier coupon.
   */
  money: {
    settledSlips: number;
    settledStake: string;
    returned: string;
    net: string;
    pendingStake: string;
    firstSlipAt: string | null;
  };
};
