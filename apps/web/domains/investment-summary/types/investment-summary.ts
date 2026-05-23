export type InvestmentSummaryCanal =
  | 'EV'
  | 'SV'
  | 'BB'
  | 'NUL'
  | 'CONF'
  | 'COUPON';

export type InvestmentSummaryStats = {
  total: number;
  won: number;
  lost: number;
  roi: string | null;
  roiPickCount: number;
};

export type InvestmentSummaryProgressionPoint = {
  date: string;
  won: number;
  lost: number;
};

export type InvestmentSummaryPickRow = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  scheduledAt: string;
  canal: Exclude<InvestmentSummaryCanal, 'COUPON'>;
  market: string;
  pick: string;
  odds: string | null;
  result: 'WON' | 'LOST';
};

export type InvestmentSummaryCouponLeg = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  scheduledAt: string;
  canal: string;
  market: string;
  pick: string;
  odds: number | null;
  isCorrect: boolean | null;
};

export type InvestmentSummaryCouponRow = {
  id: string;
  forDate: string;
  rank: number;
  combinedOdds: number;
  jointProbability: number;
  result: 'WON' | 'LOST';
  legs: InvestmentSummaryCouponLeg[];
};

export type InvestmentSummaryResponse = {
  canal: InvestmentSummaryCanal;
  stats: InvestmentSummaryStats;
  progression: InvestmentSummaryProgressionPoint[];
  picks: InvestmentSummaryPickRow[];
  coupons: InvestmentSummaryCouponRow[];
};
