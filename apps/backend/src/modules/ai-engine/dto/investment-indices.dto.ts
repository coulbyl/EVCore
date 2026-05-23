import type { InvestmentIndicesCanal } from './investment-indices-query.dto';

export type InvestmentIndicesRow = {
  probability: number; // 1-decimal percentage, e.g. 65.3 means 65.3%
  total: number;
  won: number;
  hitRate: number;
  isGood: boolean;
};

export type InvestmentIndicesResponse = {
  canal: InvestmentIndicesCanal;
  from: string;
  to: string;
  rows: InvestmentIndicesRow[];
  summary: {
    total: number;
    won: number;
    hitRate: number;
  };
};
