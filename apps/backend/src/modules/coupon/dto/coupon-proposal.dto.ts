import type {
  CouponProposalStatus,
  CouponResult,
  Market,
  StrategyChannel,
} from '@evcore/db';

export type CouponLegDto = {
  id: string;
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  country: string;
  scheduledAt: string;
  canal: StrategyChannel;
  market: Market;
  pick: string;
  /** Same-match combo secondary market/pick (Étape 6). `null` for a single leg. */
  comboMarket: Market | null;
  comboPick: string | null;
  probability: number;
  oddsSnapshot: number | null;
  signalScore: number;
  isCorrect: boolean | null;
};

export type CouponProposalDto = {
  id: string;
  forDate: string;
  rank: number;
  signalWindowDays: number;
  targetOddsMin: number;
  targetOddsMax: number;
  combinedOdds: number;
  jointProbability: number;
  signalScore: number;
  status: CouponProposalStatus;
  result: CouponResult | null;
  reasoning: Record<string, unknown> | null;
  lastFixtureScheduledAt: string;
  legs: CouponLegDto[];
  generatedAt: string;
};
