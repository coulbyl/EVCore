import type { CouponIndicesCanal } from './coupon-indices-query.dto';

export type CouponIndicesRow = {
  probability: number; // 1-decimal percentage, e.g. 65.3 means 65.3%
  total: number;
  won: number;
  hitRate: number;
  isGood: boolean;
};

export type CouponIndicesMarketRow = {
  market: string;
  label: string;
  total: number;
  won: number;
  hitRate: number;
  roi: number | null;
};

export type CouponIndicesOddsRow = {
  label: string;
  from: number;
  to: number;
  total: number;
  won: number;
  hitRate: number;
  roi: number;
};

export type CouponIndicesResponse = {
  canal: CouponIndicesCanal;
  from: string;
  to: string;
  rows: CouponIndicesRow[];
  summary: {
    total: number;
    won: number;
    hitRate: number;
    roi: number | null;
  };
  byMarket: CouponIndicesMarketRow[];
  byOddsRange: CouponIndicesOddsRow[] | null;
};
