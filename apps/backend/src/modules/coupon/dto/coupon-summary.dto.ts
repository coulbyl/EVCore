import type { CouponSummaryCanal } from './coupon-summary-query.dto';

export type CouponSummaryStats = {
  total: number;
  won: number;
  lost: number;
  roi: string | null;
  roiPickCount: number;
};

export type CouponSummaryProgressionPoint = {
  date: string;
  won: number;
  lost: number;
};

export type CouponSummaryPickRow = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  scheduledAt: string;
  canal: Exclude<CouponSummaryCanal, 'COUPON'>;
  market: string;
  pick: string;
  odds: string | null;
  result: 'WON' | 'LOST';
};

export type CouponSummaryLeg = {
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

export type CouponSummaryRow = {
  id: string;
  forDate: string;
  rank: number;
  combinedOdds: number;
  jointProbability: number;
  result: 'WON' | 'LOST';
  legs: CouponSummaryLeg[];
};

export type CouponSummaryResponse = {
  canal: CouponSummaryCanal;
  stats: CouponSummaryStats;
  progression: CouponSummaryProgressionPoint[];
  picks: CouponSummaryPickRow[];
  coupons: CouponSummaryRow[];
};
