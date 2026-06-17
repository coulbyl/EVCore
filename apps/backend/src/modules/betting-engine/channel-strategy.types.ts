import type Decimal from 'decimal.js';
import type { Market } from '@evcore/db';
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchProbabilities,
} from './betting-engine.types';

// Defined here until Étape 2 creates the Prisma enum SportType.
// String-literal union intentionally matches the future enum values for a clean swap.
export type SportType = 'FOOTBALL';

export const STRATEGY_CHANNEL = {
  EV: 'EV',
  SAFE: 'SAFE',
  DOMINANT: 'DOMINANT',
  BTTS: 'BTTS',
  DRAW: 'DRAW',
  GOALS: 'GOALS',
  FIRST_HALF: 'FIRST_HALF',
  DOUBLE_CHANCE: 'DOUBLE_CHANCE',
  UNDERDOG: 'UNDERDOG',
  FAVORITE: 'FAVORITE',
  LIVE_VALUE: 'LIVE_VALUE',
  MARKET_MOVE: 'MARKET_MOVE',
  CONSENSUS: 'CONSENSUS',
  CONTRARIAN: 'CONTRARIAN',
  AVOID: 'AVOID',
} as const;
export type StrategyChannel =
  (typeof STRATEGY_CHANNEL)[keyof typeof STRATEGY_CHANNEL];

export const CHANNEL_DECISION_STATUS = {
  SELECTED: 'SELECTED',
  REJECTED: 'REJECTED',
  DISABLED: 'DISABLED',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  MISSING_ODDS: 'MISSING_ODDS',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;
export type ChannelDecisionStatus =
  (typeof CHANNEL_DECISION_STATUS)[keyof typeof CHANNEL_DECISION_STATUS];

export const MODEL_RUN_PHASE = {
  ADVANCE: 'ADVANCE',
  PRE_KICKOFF: 'PRE_KICKOFF',
  LIVE: 'LIVE',
} as const;
export type ModelRunPhase =
  (typeof MODEL_RUN_PHASE)[keyof typeof MODEL_RUN_PHASE];

// Meta-strategies run in Phase 2 (after all primary decisions are available).
export const META_STRATEGY_CHANNELS = new Set<StrategyChannel>([
  STRATEGY_CHANNEL.CONSENSUS,
  STRATEGY_CHANNEL.CONTRARIAN,
  STRATEGY_CHANNEL.AVOID,
]);

export type FixtureSnapshot = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: Date;
};

export type EvaluatedMarket = {
  market: Market;
  picks: EvaluatedPick[];
};

export type ContextSignals = {
  suspendedMarkets: ReadonlySet<Market>;
  lambdaFloorHit: boolean;
  lambdaTotal: number;
  lineMovement: number | null;
  h2h: number | null;
  congestion: number | null;
};

export type StrategyContext = {
  fixture: FixtureSnapshot;
  // null when the fixture has no competition code — getters fall back to defaults.
  competitionCode: string | null;
  sport: SportType;
  phase: ModelRunPhase;
  deterministicScore: Decimal;
  probabilities: MatchProbabilities;
  evaluatedMarkets: EvaluatedMarket[];
  odds: FullOddsSnapshot | null;
  signals: ContextSignals;
  previousDecisions: ReadonlyMap<StrategyChannel, StrategyDecision>;
};

export type StrategySelection = {
  market: Market;
  pick: string;
  comboMarket?: Market;
  comboPick?: string;
  probability: Decimal;
  odds?: Decimal;
  impliedProbability?: Decimal;
  ev?: Decimal;
  qualityScore?: Decimal;
  rank: number;
};

export type StrategyDecision = {
  channel: StrategyChannel;
  status: ChannelDecisionStatus;
  reasonCode?: string;
  reasonDetails?: Record<string, unknown>;
  selections: StrategySelection[];
};

export interface ChannelStrategy {
  readonly channel: StrategyChannel;
  readonly allowedMarkets: readonly Market[];
  // [multi-sport] undefined = applicable to all sports
  readonly allowedSports?: readonly SportType[];
  evaluate(context: StrategyContext): StrategyDecision;
}
