export type InvestmentIndicesCanal =
  | "EV"
  | "SV"
  | "BB"
  | "NUL"
  | "CONF"
  | "COUPON";

export type InvestmentIndicesRow = {
  probability: number;
  total: number;
  won: number;
  hitRate: number;
  isGood: boolean;
};

export type InvestmentIndicesMarketRow = {
  market: string;
  label: string;
  total: number;
  won: number;
  hitRate: number;
  roi: number | null;
};

export type InvestmentIndicesOddsRow = {
  label: string;
  from: number;
  to: number;
  total: number;
  won: number;
  hitRate: number;
  roi: number;
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
    roi: number | null;
  };
  byMarket: InvestmentIndicesMarketRow[];
  byOddsRange: InvestmentIndicesOddsRow[] | null;
};
