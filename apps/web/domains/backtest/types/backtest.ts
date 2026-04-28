export type NumericLike = number | string;

export type BacktestMarketPerformance = {
  market: string;
  betsPlaced: number;
  wins: number;
  losses: number;
  voids: number;
  stake: NumericLike;
  profit: NumericLike;
  roi: NumericLike;
  averageOdds: NumericLike;
  averageEv: NumericLike;
  maxDrawdown: NumericLike;
};

export type CompetitionBacktestReport = {
  competitionId: string;
  competitionCode: string;
  competitionName: string;
  totalFixtures: number;
  totalAnalyzed: number;
  totalBets: number;
  averageBrierScore: NumericLike;
  averageCalibrationError: NumericLike;
  aggregateRoi: NumericLike;
  maxDrawdownSimulated: NumericLike;
  marketPerformance: BacktestMarketPerformance[];
  reportGeneratedAt: string;
};

export type BacktestSeasonReport = {
  seasonId?: string;
  fixtureCount: number;
  analyzedCount: number;
  skippedCount: number;
  brierScore: NumericLike;
  calibrationError?: NumericLike;
  roiSimulated: NumericLike;
  maxDrawdownSimulated: NumericLike;
  averageEvSimulated?: NumericLike;
  marketPerformance: BacktestMarketPerformance[];
  reportGeneratedAt: string;
};

export type BacktestResponse =
  | CompetitionBacktestReport[]
  | BacktestSeasonReport;
