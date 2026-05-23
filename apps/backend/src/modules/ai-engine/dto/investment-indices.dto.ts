import type { InvestmentIndicesCanal } from './investment-indices-query.dto';

export type InvestmentIndicesBucket = {
  label: string;
  min: number;
  max: number;
  total: number;
  won: number;
  hitRate: number;
  isGood: boolean;
};

export type InvestmentIndicesResponse = {
  canal: InvestmentIndicesCanal;
  from: string;
  to: string;
  buckets: InvestmentIndicesBucket[];
  summary: {
    total: number;
    won: number;
    hitRate: number;
  };
};
