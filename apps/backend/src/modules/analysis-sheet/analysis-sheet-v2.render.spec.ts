import { describe, expect, it } from 'vitest';
import { buildJsonSheet, type SheetMeta } from './analysis-sheet.render';
import type { AnalysisSheetFixture } from './analysis-sheet.repository';
import {
  ANALYSIS_SHEET_SCHEMA_VERSION,
  buildJsonSheetV2,
  isTargetEvaluatedPick,
} from './analysis-sheet-v2.render';
import type { FixtureV2Extras } from './analysis-sheet-v2.service';
import { applyExportFilters } from './analysis-sheet-v2.filters';

const meta: SheetMeta = {
  generatedAt: '2026-09-12T00:00:00.000Z',
  range: { from: '2026-09-11', to: '2026-09-13' },
  filters: { competitionCode: null, channel: null },
};

function fixture(
  overrides: Partial<AnalysisSheetFixture> = {},
): AnalysisSheetFixture {
  return {
    fixtureId: 'fx-1',
    scheduledAt: new Date('2026-09-12T18:00:00.000Z'),
    status: 'SCHEDULED',
    homeScore: null,
    awayScore: null,
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    homeTeamId: 'team-home',
    awayTeamId: 'team-away',
    seasonId: 'season-1',
    competitionCode: 'PL',
    competitionName: 'Premier League',
    competitionCountry: 'England',
    modelRunId: 'mr-1',
    analyzedAt: new Date('2026-09-11T20:00:00.000Z'),
    deterministicScore: 0.71,
    finalScore: 0.71,
    features: {
      lambdaHome: 1.42,
      lambdaAway: 1.18,
      shadow_h2h: 0.6,
      shadow_congestion: 0,
      evaluatedPicks: [
        {
          market: 'ONE_X_TWO',
          pick: 'HOME',
          probability: 0.55,
          odds: 2,
          ev: 0.1,
          status: 'viable',
          rejectionReason: null,
        },
        {
          market: 'CORRECT_SCORE',
          pick: '2-1',
          probability: 0.09,
          odds: 9,
          ev: -0.19,
          status: 'rejected',
          rejectionReason: 'probability_too_low',
        },
      ],
    },
    selections: [
      {
        channel: 'VALUE',
        decisionStatus: 'SELECTED',
        reasonCode: null,
        reasonDetails: null,
        market: 'ONE_X_TWO',
        pick: 'HOME',
        probability: 0.55,
        odds: 2,
        ev: 0.1,
        qualityScore: 0.3,
        rank: 1,
        result: null,
      },
    ],
    priorPasses: [
      {
        modelRunId: 'mr-0',
        analyzedAt: new Date('2026-09-10T20:00:00.000Z'),
        phase: 'ADVANCE',
        selectedPicks: [
          {
            channel: 'VALUE',
            decisionStatus: 'SELECTED',
            reasonCode: null,
            reasonDetails: null,
            market: 'ONE_X_TWO',
            pick: 'HOME',
            probability: 0.53,
            odds: 2.1,
            ev: 0.11,
            qualityScore: 0.29,
            rank: 1,
            result: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

const EMPTY_EXPORT_OPTIONS = {
  statuses: null,
  markets: null,
  excludeChannels: null,
  compact: false,
  includeContext: false,
  includeCalibration: false,
  includeLegPool: false,
};

function renderV2(
  fixtures: AnalysisSheetFixture[],
  options: Partial<typeof EMPTY_EXPORT_OPTIONS> = {},
  extras: Map<string, FixtureV2Extras> = new Map(),
) {
  return buildJsonSheetV2(buildJsonSheet(fixtures, meta), {
    extrasByFixture: extras,
    meta: { definitions: [], constants: {}, caveats: [] },
    calibration: null,
    legPool: null,
    exportOptions: { ...EMPTY_EXPORT_OPTIONS, ...options },
  });
}

describe('buildJsonSheetV2 — non-régression du schéma v1', () => {
  it('conserve à l’identique tous les champs de la fiche v1', () => {
    const fixtures = [fixture()];
    const v1 = buildJsonSheet(fixtures, meta);
    const v2 = renderV2(fixtures);

    // Toute clé de premier niveau de la v1 subsiste, avec la même valeur.
    for (const key of Object.keys(v1) as (keyof typeof v1)[]) {
      if (key === 'fixtures') continue;
      expect(v2[key]).toEqual(v1[key]);
    }

    // Et toute clé d'un match v1 subsiste dans le match v2.
    const v1Fixture = v1.fixtures[0];
    const v2Fixture = v2.fixtures[0];
    expect(v1Fixture).toBeDefined();
    for (const key of Object.keys(v1Fixture ?? {})) {
      expect(v2Fixture).toHaveProperty(key);
      expect((v2Fixture as Record<string, unknown>)[key]).toEqual(
        (v1Fixture as unknown as Record<string, unknown>)[key],
      );
    }
  });

  it('ajoute schemaVersion et les blocs v2 sans rien retirer', () => {
    const v2 = renderV2([fixture()]);

    expect(v2.schemaVersion).toBe(ANALYSIS_SHEET_SCHEMA_VERSION);
    expect(v2.fixtures[0]).toHaveProperty('lambdaTrace');
    expect(v2.fixtures[0]).toHaveProperty('dataCoverageDetail');
    expect(v2.fixtures[0]).toHaveProperty('targetMarkets');
    expect(v2.fixtures[0]).toHaveProperty('market');
    expect(v2.fixtures[0]).toHaveProperty('context');
  });

  it('rend des blocs vides motivés quand aucun enrichissement n’est disponible', () => {
    const v2 = renderV2([fixture()]);

    expect(v2.fixtures[0]?.lambdaTrace.baseDerivation).toBe('unavailable');
    expect(v2.fixtures[0]?.contextReason).not.toBeNull();
  });
});

describe('mode compact', () => {
  it('retire l’historique des passes et les picks évalués hors marchés cibles', () => {
    const full = renderV2([fixture()]);
    const compact = renderV2([fixture()], { compact: true });

    expect(full.fixtures[0]?.selectedPicks[0]?.history).toHaveLength(1);
    expect(compact.fixtures[0]?.selectedPicks[0]?.history).toHaveLength(0);

    expect(full.fixtures[0]?.evaluatedPicks).toHaveLength(2);
    expect(compact.fixtures[0]?.evaluatedPicks).toHaveLength(1);
    expect(compact.fixtures[0]?.evaluatedPicks[0]?.market).toBe('ONE_X_TWO');
  });

  it('ne touche à aucun champ de diagnostic', () => {
    const compact = renderV2([fixture()], { compact: true });

    expect(compact.fixtures[0]?.model).toBeDefined();
    expect(compact.fixtures[0]?.rejectionSummary).toBeDefined();
    expect(compact.fixtures[0]?.selectedPicks[0]?.probability).toBe(0.55);
  });
});

describe('isTargetEvaluatedPick', () => {
  it('reconnaît les 7 marchés cibles et rejette les autres', () => {
    const pick = (market: string, pickCode: string) => ({
      market,
      pick: pickCode,
      label: '',
      probability: 0,
      odds: 0,
      ev: 0,
      status: 'viable' as const,
      rejectionReason: null,
      adjustmentDelta: null,
    });

    expect(isTargetEvaluatedPick(pick('ONE_X_TWO', 'HOME'))).toBe(true);
    expect(isTargetEvaluatedPick(pick('OVER_UNDER', 'OVER_1_5'))).toBe(true);
    expect(isTargetEvaluatedPick(pick('OVER_UNDER', 'OVER'))).toBe(true);
    expect(isTargetEvaluatedPick(pick('TO_WIN_EITHER_HALF', 'AWAY'))).toBe(
      true,
    );
    expect(isTargetEvaluatedPick(pick('BTTS', 'YES'))).toBe(true);

    expect(isTargetEvaluatedPick(pick('ONE_X_TWO', 'DRAW'))).toBe(false);
    expect(isTargetEvaluatedPick(pick('BTTS', 'NO'))).toBe(false);
    expect(isTargetEvaluatedPick(pick('CORRECT_SCORE', '2-1'))).toBe(false);
  });
});

describe('applyExportFilters', () => {
  it('ne filtre rien par défaut', () => {
    const fixtures = [fixture()];
    expect(
      applyExportFilters(fixtures, {
        statuses: null,
        markets: null,
        excludeChannels: null,
      }),
    ).toEqual(fixtures);
  });

  it('restreint par statut de match', () => {
    const filtered = applyExportFilters(
      [fixture(), fixture({ fixtureId: 'fx-2', status: 'FINISHED' })],
      { statuses: ['SCHEDULED'], markets: null, excludeChannels: null },
    );

    expect(filtered.map((f) => f.fixtureId)).toEqual(['fx-1']);
  });

  it('retire les décisions d’un canal exclu', () => {
    const filtered = applyExportFilters([fixture()], {
      statuses: null,
      markets: null,
      excludeChannels: ['VALUE'],
    });

    expect(filtered[0]?.selections).toHaveLength(0);
    expect(filtered[0]?.priorPasses[0]?.selectedPicks).toHaveLength(0);
  });

  it('restreint les picks évalués aux marchés demandés', () => {
    const filtered = applyExportFilters([fixture()], {
      statuses: null,
      markets: ['ONE_X_TWO'],
      excludeChannels: null,
    });

    const features = filtered[0]?.features as {
      evaluatedPicks: { market: string }[];
    };
    expect(features.evaluatedPicks.map((p) => p.market)).toEqual(['ONE_X_TWO']);
  });

  it('conserve une décision sans marché — retirer un drapeau serait une perte', () => {
    const withAvoid = fixture({
      selections: [
        {
          channel: 'AVOID',
          decisionStatus: 'SELECTED',
          reasonCode: 'extreme_divergence',
          reasonDetails: { maxEdge: 0.3, offenders: [] },
          market: null,
          pick: null,
          probability: null,
          odds: null,
          ev: null,
          qualityScore: null,
          rank: null,
          result: null,
        },
      ],
    });

    const filtered = applyExportFilters([withAvoid], {
      statuses: null,
      markets: ['BTTS'],
      excludeChannels: null,
    });

    expect(filtered[0]?.selections).toHaveLength(1);
    expect(filtered[0]?.selections[0]?.channel).toBe('AVOID');
  });
});
