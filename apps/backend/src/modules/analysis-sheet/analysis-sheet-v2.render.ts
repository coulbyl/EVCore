// Rendu du schéma v2 — la fiche v1 enrichie, jamais amputée.
//
// Non-régression : `buildJsonSheetV2` part du résultat exact de
// `buildJsonSheet` (v1) et n'ajoute que des clés. Aucun champ v1 n'est
// supprimé, renommé ni réordonné — les scripts d'analyse existants continuent
// de lire la fiche sans modification.

import type {
  AnalysisSheetJson,
  AnalysisSheetJsonEvaluatedPick,
  AnalysisSheetJsonFixture,
} from './analysis-sheet.render';
import type { FixtureV2Extras } from './analysis-sheet-v2.service';
import {
  TARGET_MARKETS,
  type CalibrationBlock,
  type DataCoverageDetail,
  type FixtureContext,
  type LambdaTrace,
  type LegPool,
  type MarketQuote,
  type SheetMetaV2,
  type TargetMarketEvaluation,
} from './analysis-sheet-v2.types';

export const ANALYSIS_SHEET_SCHEMA_VERSION = '2.0' as const;

export type AnalysisSheetJsonFixtureV2 = AnalysisSheetJsonFixture & {
  /** Données brutes d'avant-match. null quand le contexte n'a pas été demandé. */
  context: FixtureContext | null;
  /** Motif quand `context` est null. */
  contextReason: string | null;
  /** Les 7 marchés cibles : cotes, probabilité implicite, mouvement de ligne. */
  market: MarketQuote[];
  lambdaTrace: LambdaTrace;
  dataCoverageDetail: DataCoverageDetail;
  /** Les 7 marchés cibles, toujours présents — même rejetés, même non cotés. */
  targetMarkets: TargetMarketEvaluation[];
};

export type AnalysisSheetJsonV2 = Omit<AnalysisSheetJson, 'fixtures'> & {
  schemaVersion: typeof ANALYSIS_SHEET_SCHEMA_VERSION;
  meta: SheetMetaV2;
  /** Filtres d'export effectivement appliqués, au-delà de ceux de la v1. */
  exportOptions: {
    statuses: string[] | null;
    markets: string[] | null;
    excludeChannels: string[] | null;
    compact: boolean;
    includeContext: boolean;
    includeCalibration: boolean;
    includeLegPool: boolean;
  };
  calibration: CalibrationBlock | null;
  legPool: LegPool | null;
  fixtures: AnalysisSheetJsonFixtureV2[];
};

const TARGET_PICK_KEYS = new Set(
  TARGET_MARKETS.map(({ market, pick }) => `${market}:${pick}`),
);

/** Un pick évalué porte-t-il sur l'un des 7 marchés cibles. */
export function isTargetEvaluatedPick(
  pick: AnalysisSheetJsonEvaluatedPick,
): boolean {
  return TARGET_PICK_KEYS.has(`${pick.market}:${pick.pick}`);
}

export type V2RenderOptions = {
  extrasByFixture: Map<string, FixtureV2Extras>;
  meta: SheetMetaV2;
  calibration: CalibrationBlock | null;
  legPool: LegPool | null;
  exportOptions: AnalysisSheetJsonV2['exportOptions'];
};

/**
 * Enrichit une fiche v1 déjà construite.
 *
 * Le mode `compact` retire deux choses, et deux seulement : l'historique des
 * passes d'analyse (`selectedPicks[].history`) et les `evaluatedPicks` hors
 * marchés cibles — soit 83 % du volume des picks évalués sur une fenêtre type
 * (37 047 cibles sur 218 245). Aucun champ de diagnostic n'est retiré.
 */
export function buildJsonSheetV2(
  sheet: AnalysisSheetJson,
  options: V2RenderOptions,
): AnalysisSheetJsonV2 {
  const { extrasByFixture, exportOptions } = options;

  const fixtures = sheet.fixtures.map((fixture): AnalysisSheetJsonFixtureV2 => {
    const extras = extrasByFixture.get(fixture.fixtureId);

    const base: AnalysisSheetJsonFixture = exportOptions.compact
      ? {
          ...fixture,
          selectedPicks: fixture.selectedPicks.map((pick) => ({
            ...pick,
            history: [],
          })),
          evaluatedPicks: fixture.evaluatedPicks.filter(isTargetEvaluatedPick),
        }
      : fixture;

    return {
      ...base,
      context: extras?.context ?? null,
      contextReason:
        extras?.contextReason ??
        (extras ? null : 'aucun enrichissement v2 pour ce match'),
      market: extras?.market ?? [],
      lambdaTrace: extras?.lambdaTrace ?? emptyLambdaTrace(),
      dataCoverageDetail: extras?.dataCoverageDetail ?? emptyCoverageDetail(),
      targetMarkets: extras?.targetMarkets ?? [],
    };
  });

  return {
    ...sheet,
    schemaVersion: ANALYSIS_SHEET_SCHEMA_VERSION,
    meta: options.meta,
    exportOptions,
    calibration: options.calibration,
    legPool: options.legPool,
    fixtures,
  };
}

/** Repli explicite : un match sans enrichissement rend des blocs vides motivés. */
function emptyLambdaTrace(): LambdaTrace {
  return {
    base: null,
    inputs: {
      homeXgFor: null,
      homeXgAgainst: null,
      awayXgFor: null,
      awayXgAgainst: null,
      meanLambda: null,
      homeAdvFactor: null,
      awayDisadvFactor: null,
      lambdaScale: null,
      shrinkageFactor: null,
    },
    formula: '',
    steps: [],
    final: null,
    floorHit: null,
    baseDerivation: 'unavailable',
    notes: ['Aucun enrichissement v2 disponible pour ce match.'],
    reason: 'predates_field',
  };
}

function emptyCoverageDetail(): DataCoverageDetail {
  return { ratio: 0, level: 0, maxLevel: 3, components: [] };
}
