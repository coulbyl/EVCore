export type CouponLegDto = {
  id: string;
  fixtureId: string;
  homeTeam: string;
  homeLogo: string | null;
  awayTeam: string;
  awayLogo: string | null;
  competition: string;
  scheduledAt: string;
  canal: "EV" | "SV" | "BB" | "NUL" | "CONF";
  market: string;
  pick: string;
  probability: number;
  oddsSnapshot: number | null;
  signalScore: number;
  isCorrect: boolean | null;
};

export type CouponStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
export type CouponResult = "WON" | "LOST" | "PARTIAL" | "VOID";

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
  status: CouponStatus;
  result: CouponResult | null;
  reasoning: Record<string, unknown> | null;
  lastFixtureScheduledAt: string;
  generatedAt: string;
  legs: CouponLegDto[];
};
