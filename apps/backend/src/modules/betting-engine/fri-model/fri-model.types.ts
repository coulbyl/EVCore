import type Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import type {
  FullOddsSnapshot,
  MatchProbabilities,
  PredictionSource,
} from '../betting-engine.types';

export type FriFixtureInput = {
  fixtureId: string;
  scheduledAt: Date;
  competitionCode: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  hasMarketOdds: boolean;
  pinnacleOdds: FullOddsSnapshot | null;
};

export type FriEloSnapshot = {
  snapshotAt: Date | null;
  ratings: Map<string, number>;
};

export type FriModelMetadata = {
  isSenior: boolean;
  eloHome: number | null;
  eloAway: number | null;
  fallbackReason: string | null;
  snapshotAt: Date | null;
};

export type FriModelComputation = {
  predictionSource: PredictionSource | null;
  probabilities: MatchProbabilities | null;
  deterministicScore: Decimal;
  lambda: { home: number; away: number } | null;
  distHome: number[];
  distAway: number[];
  supportedMarkets: ReadonlySet<Market>;
  metadata: FriModelMetadata;
};

export type HistoricalFriEloFixtureInput = {
  fixtureId: string;
  scheduledAt: Date;
  homeTeamName: string | null;
  awayTeamName: string | null;
};

export type HistoricalFriEloFixtureEntry = {
  home: number | null;
  away: number | null;
  snapshotAt: Date | null;
};
