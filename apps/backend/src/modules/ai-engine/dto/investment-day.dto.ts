import type { Canal } from '../signal-window.service';

export type InvestmentPickDto = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  scheduledAt: string;
  canal: Canal;
  market: string;
  pick: string;
  probability: number;
  calibratedHitRate: number;
  oddsSnapshot: number | null;
  isCorrect: boolean | null;
  signalScore: number;
  reasoning: string | null;
};

export type InvestmentLegDto = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  canal: Canal;
  market: string;
  pick: string;
  oddsSnapshot: number | null;
  isCorrect: boolean | null;
  calibratedHitRate: number;
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
  selections: Record<Canal, InvestmentPickDto[]>;
  coupons: InvestmentCouponDto[];
};
