export type InvestmentCanal = "EV" | "SV" | "BB" | "NUL" | "CONF";

export type InvestmentPickDto = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
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
  homeLogo: string | null;
  awayLogo: string | null;
};

export type InvestmentLegDto = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
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
  selections: Record<InvestmentCanal, InvestmentPickDto[]>;
  coupons: InvestmentCouponDto[];
};
