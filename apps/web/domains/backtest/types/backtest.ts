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

export type BacktestSeasonSummary = {
  seasonId: string;
  fixtureCount: number;
  analyzedCount: number;
  brierScore: NumericLike;
  roiSimulated: NumericLike;
  maxDrawdownSimulated: NumericLike;
  reportGeneratedAt: string;
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
  seasons?: BacktestSeasonSummary[];
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

export type SafeValueSeasonResult = {
  seasonId: string;
  competitionCode: string;
  competitionName: string;
  picksPlaced: number;
  wins: number;
  losses: number;
  voids: number;
  roi: number;
  winRate: number;
  avgOdds: number;
  avgEv: number;
};

export type SafeValueAggregate = {
  picksPlaced: number;
  wins: number;
  losses: number;
  voids: number;
  roi: number;
  winRate: number;
  avgOdds: number;
  avgEv: number;
  daysWithPicks: number;
  marketPerformance: BacktestMarketPerformance[];
};

export type SafeValueBacktestReport = {
  seasons: SafeValueSeasonResult[];
  aggregate: SafeValueAggregate;
  generatedAt: string;
};
