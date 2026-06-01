export type CoreInvestmentCanal = "EV" | "SV" | "BB" | "NUL" | "CONF";

export type VirtualInvestmentCanal =
  | "SAFE_HT_OVER05"
  | "SAFE_UNDER45"
  | "SAFE_OVER15"
  | "SAFE_UNDER35"
  | "BTTS_YES";

export type InvestmentCanal = CoreInvestmentCanal | VirtualInvestmentCanal;

export type InvestmentPickDto = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  country: string;
  scheduledAt: string;
  canal: InvestmentCanal;
  market: string;
  pick: string;
  probability: number;
  calibratedHitRate: number;
  oddsSnapshot: number | null;
  isCorrect: boolean | null;
  signalScore: number;
  reasoning: string | null;
  betId: string | null;
  modelRunId: string | null;
  score: string | null;
  htScore: string | null;
  homeLogo: string | null;
  awayLogo: string | null;
};

export type InvestmentLegDto = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  country: string;
  scheduledAt: string;
  canal: InvestmentCanal;
  market: string;
  pick: string;
  oddsSnapshot: number | null;
  isCorrect: boolean | null;
  calibratedHitRate: number;
  betId: string | null;
  modelRunId: string | null;
  homeLogo: string | null;
  awayLogo: string | null;
};

export type InvestmentCouponDto = {
  rank: number;
  legs: InvestmentLegDto[];
  combinedOdds: number;
  jointProbability: number;
  signalScore: number;
  reasoning: string | null;
};

export type InvestmentDayDto = {
  date: string;
  windowDays: number;
  isAiCurated: boolean;
  totalCandidates: number;
  selections: Record<CoreInvestmentCanal, InvestmentPickDto[]>;
  virtualSelections: Record<VirtualInvestmentCanal, InvestmentPickDto[]>;
  virtualTop5: InvestmentPickDto[];
  virtualTop10: InvestmentPickDto[];
  coupons: InvestmentCouponDto[];
};
