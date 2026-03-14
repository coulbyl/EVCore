import Decimal from 'decimal.js';
import { Market } from '@evcore/db';

export type ValidationVerdict = 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA';

export type MetricResult = {
  value: Decimal;
  threshold: Decimal;
  verdict: ValidationVerdict;
};

export type CompetitionBacktestSummary = {
  competitionId: string;
  competitionCode: string;
  competitionName: string;
  seasonCount: number;
  totalAnalyzed: number;
  averageBrierScore: Decimal;
  averageCalibrationError: Decimal;
  aggregateRoi: Decimal;
};

export type AllSeasonsBacktestReport = {
  seasons: BacktestReport[];
  totalFixtures: number;
  totalAnalyzed: number;
  averageBrierScore: Decimal;
  averageCalibrationError: Decimal;
  aggregateRoi: Decimal;
  byCompetition: CompetitionBacktestSummary[];
  reportGeneratedAt: Date;
};

export type ValidationReport = {
  brierScore: MetricResult;
  calibrationError: MetricResult;
  roi: MetricResult;
  totalAnalyzed: number;
  overallVerdict: ValidationVerdict;
  byCompetition: CompetitionBacktestSummary[];
  reportGeneratedAt: Date;
};

export type OneXTwoOutcome = 'HOME' | 'DRAW' | 'AWAY';

export type OneXTwoPrediction = {
  home: number;
  draw: number;
  away: number;
  actual: OneXTwoOutcome;
};

export type CalibrationPoint = {
  prob: number;
  actual: 0 | 1;
};

export type BacktestReport = {
  seasonId: string;
  fixtureCount: number;
  analyzedCount: number;
  skippedCount: number;
  brierScore: Decimal;
  calibrationError: Decimal;
  roiSimulated: Decimal;
  maxDrawdownSimulated: Decimal;
  averageEvSimulated: Decimal;
  marketPerformance: BacktestMarketPerformance[];
  reportGeneratedAt: Date;
};

export type BacktestMarketPerformance = {
  market: Market;
  betsPlaced: number;
  wins: number;
  losses: number;
  voids: number;
  stake: Decimal;
  profit: Decimal;
  roi: Decimal;
  averageEv: Decimal;
  maxDrawdown: Decimal;
};

export function getOneXTwoOutcome(
  homeScore: number,
  awayScore: number,
): OneXTwoOutcome {
  if (homeScore > awayScore) return 'HOME';
  if (homeScore < awayScore) return 'AWAY';
  return 'DRAW';
}

export function brierScoreOneXTwo(predictions: OneXTwoPrediction[]): number {
  if (predictions.length === 0) return 0;

  const sum = predictions.reduce((acc, p) => {
    const oHome = p.actual === 'HOME' ? 1 : 0;
    const oDraw = p.actual === 'DRAW' ? 1 : 0;
    const oAway = p.actual === 'AWAY' ? 1 : 0;
    return (
      acc +
      (p.home - oHome) ** 2 +
      (p.draw - oDraw) ** 2 +
      (p.away - oAway) ** 2
    );
  }, 0);

  return sum / predictions.length;
}

export function calibrationError(
  points: CalibrationPoint[],
  bucketCount = 10,
): number {
  if (points.length === 0) return 0;

  const buckets = Array.from(
    { length: bucketCount },
    () => [] as CalibrationPoint[],
  );
  for (const point of points) {
    const clipped = Math.min(0.999999, Math.max(0, point.prob));
    const idx = Math.floor(clipped * bucketCount);
    buckets[idx].push(point);
  }

  let ece = 0;
  for (const bucket of buckets) {
    if (bucket.length === 0) continue;
    const avgProb = bucket.reduce((s, p) => s + p.prob, 0) / bucket.length;
    const avgActual = bucket.reduce((s, p) => s + p.actual, 0) / bucket.length;
    ece += (bucket.length / points.length) * Math.abs(avgProb - avgActual);
  }

  return ece;
}
