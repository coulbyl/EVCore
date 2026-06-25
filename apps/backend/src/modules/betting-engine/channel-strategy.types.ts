import type Decimal from 'decimal.js';
import type {
  ChannelDecisionStatus,
  Market,
  ModelRunPhase,
  SportType,
  StrategyChannel,
} from '@evcore/analysis-core';
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchProbabilities,
} from './betting-engine.types';

// Domain enums (Market, StrategyChannel, ChannelDecisionStatus, ModelRunPhase,
// SportType) now live in @evcore/analysis-core — single source of truth shared
// by prod and backtest, guarded against the Prisma schema by
// `domain-enums.conformance.spec.ts`. Re-exported here so the many existing
// `./channel-strategy.types` imports across the module keep resolving unchanged.
export {
  STRATEGY_CHANNEL,
  META_STRATEGY_CHANNELS,
  CHANNEL_DECISION_STATUS,
  MODEL_RUN_PHASE,
  SPORT_TYPE,
} from '@evcore/analysis-core';
export type {
  StrategyChannel,
  ChannelDecisionStatus,
  ModelRunPhase,
  SportType,
} from '@evcore/analysis-core';

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

// PRINCIPE (tout canal doit le respecter) : une sélection attache toujours son
// prix marché quand le book en a un — `odds`, `impliedProbability`, `ev` — pour
// que chaque canal soit auditable sur EV/ROI de la même façon, pas seulement
// EV/SAFE. Utiliser `priceForSelection` (strategies/selection-odds.ts), jamais
// recalculer l'EV inline. Les champs restent absents si aucune cote n'existe,
// pour que les canaux de prédiction enregistrent quand même une sélection
// (settlement analytique). Exception assumée : DRAW, dont le signal EST la proba
// implicite (1/drawOdds) → EV structurellement nul, donc non reporté.
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
