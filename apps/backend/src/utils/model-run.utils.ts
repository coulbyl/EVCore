import { formatSigned } from '@modules/dashboard/dashboard.utils';
import type { PredictionSource } from '@modules/betting-engine/betting-engine.types';

// ── EVA evaluation context ────────────────────────────────────────────────────

export type EvaPickFromFeature = {
  market: string;
  pick: string;
  probability: number;
  odds: number;
  ev: number;
  status: 'viable' | 'rejected';
  rejectionReason: string | null;
};

export type OffensiveBalanceFromFeature = {
  ratio: number;
  classification: 'BALANCED' | 'ASYMMETRIC' | 'STRONGLY_ASYMMETRIC';
} | null;

export type EvaFeaturesContext = {
  predictionSource: PredictionSource | null;
  fallbackReason: string | null;
  lambdaHome: number | null;
  lambdaAway: number | null;
  // Ratio of the weaker attack to the stronger one — see
  // analysis-core/probability/match-stats.ts computeOffensiveBalance().
  // Informational only, not consumed by any strategy threshold.
  offensiveBalance: OffensiveBalanceFromFeature;
  hasMarketOdds: boolean | null;
  hasPinnacleOdds: boolean | null;
  hasHomeElo: boolean | null;
  hasAwayElo: boolean | null;
  shadowLineMovement: number | null;
  shadowH2h: number | null;
  h2hCorrectionApplied: boolean | null;
  shadowCongestion: number | null;
  evaluatedPicks: EvaPickFromFeature[];
  // Unadjusted Poisson output (before the 1X2 empirical blend and O/U
  // shrinkage layers) — shape mirrors ModelRun.features.probabilities. Kept
  // as a raw record; per-pick deltas are computed in the analysis sheet.
  rawPoissonProbability: Record<string, unknown> | null;
};

export function extractEvaContextFromFeatures(
  features: unknown,
): EvaFeaturesContext {
  if (!features || typeof features !== 'object') {
    return emptyEvaContext();
  }

  const f = features as Record<string, unknown>;

  return {
    predictionSource: readPredictionSource(f),
    fallbackReason: readString(f, 'fallbackReason'),
    lambdaHome: readFiniteNumber(f, 'lambdaHome'),
    lambdaAway: readFiniteNumber(f, 'lambdaAway'),
    offensiveBalance: readOffensiveBalance(f),
    hasMarketOdds: readBooleanOrNull(f, 'hasMarketOdds'),
    hasPinnacleOdds: readBooleanOrNull(f, 'hasPinnacleOdds'),
    hasHomeElo: readBooleanOrNull(f, 'hasHomeElo'),
    hasAwayElo: readBooleanOrNull(f, 'hasAwayElo'),
    shadowLineMovement: readFiniteNumber(f, 'shadow_lineMovement'),
    shadowH2h: readFiniteNumber(f, 'shadow_h2h'),
    h2hCorrectionApplied: readBooleanOrNull(f, 'h2h_correction_applied'),
    shadowCongestion: readFiniteNumber(f, 'shadow_congestion'),
    evaluatedPicks: readEvaPicksFromFeature(f),
    rawPoissonProbability: readRecord(f, 'rawPoissonProbability'),
  };
}

function readRecord(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const raw = value[key];
  return raw !== null && typeof raw === 'object'
    ? (raw as Record<string, unknown>)
    : null;
}

function readOffensiveBalance(
  value: Record<string, unknown>,
): OffensiveBalanceFromFeature {
  const raw = readRecord(value, 'offensiveBalance');
  if (!raw) return null;
  const ratio = raw['ratio'];
  const classification = raw['classification'];
  if (
    typeof ratio !== 'number' ||
    (classification !== 'BALANCED' &&
      classification !== 'ASYMMETRIC' &&
      classification !== 'STRONGLY_ASYMMETRIC')
  ) {
    return null;
  }
  return { ratio, classification };
}

function emptyEvaContext(): EvaFeaturesContext {
  return {
    predictionSource: null,
    fallbackReason: null,
    lambdaHome: null,
    lambdaAway: null,
    offensiveBalance: null,
    hasMarketOdds: null,
    hasPinnacleOdds: null,
    hasHomeElo: null,
    hasAwayElo: null,
    shadowLineMovement: null,
    shadowH2h: null,
    h2hCorrectionApplied: null,
    shadowCongestion: null,
    evaluatedPicks: [],
    rawPoissonProbability: null,
  };
}

function readBooleanOrNull(
  value: Record<string, unknown>,
  key: string,
): boolean | null {
  const raw = value[key];
  if (typeof raw !== 'boolean') return null;
  return raw;
}

function readEvaPicksFromFeature(
  features: Record<string, unknown>,
): EvaPickFromFeature[] {
  const raw = features['evaluatedPicks'];
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const record = candidate as Record<string, unknown>;

    const market = readString(record, 'market');
    const pick = readString(record, 'pick');
    const probability = readFiniteNumber(record, 'probability');
    const odds = readFiniteNumber(record, 'odds');
    const ev = readFiniteNumber(record, 'ev');
    const status = readString(record, 'status');

    if (
      market === null ||
      pick === null ||
      probability === null ||
      odds === null ||
      ev === null ||
      (status !== 'viable' && status !== 'rejected')
    ) {
      return [];
    }

    const rejectionReason = readString(record, 'rejectionReason');
    return [{ market, pick, probability, odds, ev, status, rejectionReason }];
  });
}

export type PickSnapshot = {
  market: string;
  pick: string;
  probability: string;
  odds: string;
  ev: string;
  qualityScore: string;
};

export type EvaluatedPickSnapshot = PickSnapshot & {
  status: 'viable' | 'rejected';
  rejectionReason?: string;
};

export type ModelRunFactors = {
  recentForm: number | null;
  xg: number | null;
  performanceDomExt: number | null;
  volatiliteLigue: number | null;
};

export type ModelRunFeatureDiagnostics = {
  predictionSource: PredictionSource | null;
  lambdaHome: string | null;
  lambdaAway: string | null;
  expectedTotalGoals: string | null;
  candidatePicks: PickSnapshot[];
  evaluatedPicks: EvaluatedPickSnapshot[];
  factors: ModelRunFactors;
};

export function extractModelRunFeatureDiagnostics(
  features: unknown,
): ModelRunFeatureDiagnostics {
  if (!features || typeof features !== 'object') {
    return {
      predictionSource: null,
      lambdaHome: null,
      lambdaAway: null,
      expectedTotalGoals: null,
      candidatePicks: [],
      evaluatedPicks: [],
      factors: {
        recentForm: null,
        xg: null,
        performanceDomExt: null,
        volatiliteLigue: null,
      },
    };
  }

  const lh = readFiniteNumber(features, 'lambdaHome');
  const la = readFiniteNumber(features, 'lambdaAway');
  const predictionSource = readPredictionSource(features);

  return {
    predictionSource,
    lambdaHome: lh !== null ? lh.toFixed(2) : null,
    lambdaAway: la !== null ? la.toFixed(2) : null,
    expectedTotalGoals:
      lh !== null && la !== null ? (lh + la).toFixed(2) : null,
    candidatePicks: readCandidatePicks(features),
    evaluatedPicks: readEvaluatedPicks(features),
    factors: {
      recentForm: readFiniteNumber(features, 'recentForm'),
      xg: readFiniteNumber(features, 'xg'),
      performanceDomExt: readFiniteNumber(features, 'performanceDomExt'),
      volatiliteLigue: readFiniteNumber(features, 'volatiliteLigue'),
    },
  };
}

function readFiniteNumber(value: object, key: string): number | null {
  const entry = value as Record<string, unknown>;
  const raw = entry[key];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return null;
  }
  return raw;
}

function readString(value: object, key: string): string | null {
  const entry = value as Record<string, unknown>;
  const raw = entry[key];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function readPredictionSource(value: object): PredictionSource | null {
  const raw = readString(value, 'predictionSource');
  if (
    raw === 'POISSON_MAIN' ||
    raw === 'FRI_ELO_REAL' ||
    raw === 'FRI_ELO_INTERNAL' ||
    raw === 'ODDS_DEVIG'
  ) {
    return raw;
  }
  return null;
}

function readPickSnapshot(record: Record<string, unknown>): PickSnapshot[] {
  const market = readString(record, 'market');
  const pick = readString(record, 'pick');
  const probability = readFiniteNumber(record, 'probability');
  const odds = readFiniteNumber(record, 'odds');
  const ev = readFiniteNumber(record, 'ev');
  const qualityScore = readFiniteNumber(record, 'qualityScore');

  if (
    market === null ||
    pick === null ||
    probability === null ||
    odds === null ||
    ev === null ||
    qualityScore === null
  ) {
    return [];
  }

  return [
    {
      market,
      pick,
      probability: probability.toFixed(4),
      odds: odds.toFixed(2),
      ev: formatSigned(ev, 4),
      qualityScore: qualityScore.toFixed(4),
    },
  ];
}

function readCandidatePicks(features: object): PickSnapshot[] {
  const entry = features as Record<string, unknown>;
  const raw = entry['candidatePicks'];
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((candidate) =>
    candidate && typeof candidate === 'object'
      ? readPickSnapshot(candidate as Record<string, unknown>)
      : [],
  );
}

function readEvaluatedPicks(features: object): EvaluatedPickSnapshot[] {
  const entry = features as Record<string, unknown>;
  const raw = entry['evaluatedPicks'];
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];

    const record = candidate as Record<string, unknown>;
    const status = readString(record, 'status');
    if (status !== 'viable' && status !== 'rejected') return [];

    return readPickSnapshot(record).map((pick) => {
      const rejectionReason = readString(record, 'rejectionReason');
      return {
        ...pick,
        status,
        ...(rejectionReason ? { rejectionReason } : {}),
      };
    });
  });
}
