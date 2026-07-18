import type Decimal from "decimal.js";
import type {
  ChannelDecisionStatus,
  Market,
  ModelRunPhase,
  SportType,
  StrategyChannel,
} from "../types";
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchProbabilities,
} from "../selection/types";
import type { SelectionConfig } from "../selection/config";

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
  // Poisson goal expectations behind `probabilities` — exposed so the
  // CORRECT_SCORE strategy can rebuild the per-scoreline matrix on demand
  // (kept out of MatchProbabilities/features to avoid bloat). Optional: absent
  // in legacy/test contexts that don't set them.
  lambdaHome?: number;
  lambdaAway?: number;
  evaluatedMarkets: EvaluatedMarket[];
  odds: FullOddsSnapshot | null;
  signals: ContextSignals;
  previousDecisions: ReadonlyMap<StrategyChannel, StrategyDecision>;
  // League-specific config pre-built by the app from ev.constants and injected
  // here so strategies remain pure (no lookup tables in the core).
  selectionConfig: SelectionConfig;
  modelScoreThreshold: Decimal;
};

// PRINCIPE (tout canal doit le respecter) : une sélection attache toujours son
// prix marché quand le book en a un — `odds`, `impliedProbability`, `ev` — pour
// que chaque canal soit auditable sur EV/ROI de la même façon, pas seulement
// EV/SAFE. Utiliser `priceForSelection` (selection/odds.ts), jamais
// recalculer l'EV inline. Les champs restent absents si aucune cote n'existe,
// pour que les canaux de prédiction enregistrent quand même une sélection
// (settlement analytique). Exception assumée : DRAW, dont le signal EST la proba
// implicite (1/drawOdds) → EV structurellement nul, donc non reporté.
export type StrategySelection = {
  market: Market;
  pick: string;
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
