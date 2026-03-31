import { formatSigned } from '@modules/dashboard/dashboard.utils';
import type { PredictionSource } from '@modules/betting-engine/betting-engine.types';

export type PickSnapshot = {
  market: string;
  pick: string;
  comboMarket?: string;
  comboPick?: string;
  probability: string;
  odds: string;
  ev: string;
  qualityScore: string;
};

export type EvaluatedPickSnapshot = PickSnapshot & {
  status: 'viable' | 'rejected';
  rejectionReason?: string;
};

export type ModelRunFeatureDiagnostics = {
  predictionSource: PredictionSource | null;
  lambdaHome: string | null;
  lambdaAway: string | null;
  expectedTotalGoals: string | null;
  candidatePicks: PickSnapshot[];
  evaluatedPicks: EvaluatedPickSnapshot[];
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

  const comboMarket = readString(record, 'comboMarket');
  const comboPick = readString(record, 'comboPick');

  return [
    {
      market,
      pick,
      ...(comboMarket ? { comboMarket } : {}),
      ...(comboPick ? { comboPick } : {}),
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
