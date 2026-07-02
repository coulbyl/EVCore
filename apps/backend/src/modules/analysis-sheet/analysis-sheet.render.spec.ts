import { describe, expect, it } from 'vitest';
import {
  buildJsonSheet,
  buildTxtSheet,
  type SheetMeta,
} from './analysis-sheet.render';
import type { AnalysisSheetFixture } from './analysis-sheet.repository';

const meta: SheetMeta = {
  generatedAt: '2026-07-02T00:00:00.000Z',
  range: { from: '2026-06-20', to: '2026-06-27' },
  filters: { competitionCode: null, channel: null },
};

function fixture(
  overrides: Partial<AnalysisSheetFixture> = {},
): AnalysisSheetFixture {
  return {
    fixtureId: 'fx-1',
    scheduledAt: new Date('2026-06-20T15:00:00.000Z'),
    status: 'FINISHED',
    homeScore: 2,
    awayScore: 1,
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competitionCode: 'PL',
    competitionName: 'Premier League',
    modelRunId: 'mr-1',
    analyzedAt: new Date('2026-06-20T10:00:00.000Z'),
    deterministicScore: 0.71,
    finalScore: 0.71,
    features: {
      predictionSource: 'POISSON_MAIN',
      lambdaHome: 1.42,
      lambdaAway: 1.18,
    },
    selections: [],
    priorPasses: [],
    ...overrides,
  };
}

describe('buildJsonSheet', () => {
  it('collapses multi-channel selections and counts settlement per channel', () => {
    const f = fixture({
      selections: [
        {
          channel: 'VALUE',
          decisionStatus: 'SELECTED',
          reasonCode: null,
          reasonDetails: null,
          market: 'ONE_X_TWO',
          pick: 'HOME',
          comboMarket: null,
          comboPick: null,
          probability: 0.58,
          odds: 1.95,
          ev: 0.132,
          qualityScore: 0.812,
          rank: 1,
          result: 'WON',
        },
        {
          channel: 'SAFE',
          decisionStatus: 'SELECTED',
          reasonCode: null,
          reasonDetails: null,
          market: 'BTTS',
          pick: 'YES',
          comboMarket: null,
          comboPick: null,
          probability: 0.71,
          odds: 1.55,
          ev: 0.101,
          qualityScore: 0.79,
          rank: 1,
          result: 'LOST',
        },
        {
          channel: 'DOMINANT',
          decisionStatus: 'REJECTED',
          reasonCode: 'ev_below_threshold',
          reasonDetails: null,
          market: null,
          pick: null,
          comboMarket: null,
          comboPick: null,
          probability: null,
          odds: null,
          ev: null,
          qualityScore: null,
          rank: null,
          result: null,
        },
      ],
    });

    const sheet = buildJsonSheet([f], meta);

    expect(sheet.summary.fixtureCount).toBe(1);
    expect(sheet.summary.byCompetition).toEqual({ PL: 1 });
    expect(sheet.summary.byChannel).toEqual({ VALUE: 1, SAFE: 1 });
    expect(sheet.summary.settledRecord).toEqual({
      won: 1,
      lost: 1,
      pending: 0,
      void: 0,
    });

    const [jsonFixture] = sheet.fixtures;
    expect(jsonFixture.selectedPicks).toHaveLength(2);
    expect(jsonFixture.rejectionSummary).toEqual([
      {
        channel: 'DOMINANT',
        status: 'REJECTED',
        count: 1,
        topReasonCode: 'ev_below_threshold',
      },
    ]);
    expect(jsonFixture.model.lambda?.home).toBe(1.42);
    expect(jsonFixture.model.lambda?.away).toBe(1.18);
    expect(jsonFixture.model.lambda?.total).toBeCloseTo(2.6, 10);
  });

  it('aggregates rejection counts and picks the most common reason code', () => {
    const f = fixture({
      selections: [
        {
          channel: 'DRAW',
          decisionStatus: 'REJECTED',
          reasonCode: 'ev_below_threshold',
          reasonDetails: null,
          market: null,
          pick: null,
          comboMarket: null,
          comboPick: null,
          probability: null,
          odds: null,
          ev: null,
          qualityScore: null,
          rank: null,
          result: null,
        },
        {
          channel: 'DRAW',
          decisionStatus: 'REJECTED',
          reasonCode: 'ev_below_threshold',
          reasonDetails: null,
          market: null,
          pick: null,
          comboMarket: null,
          comboPick: null,
          probability: null,
          odds: null,
          ev: null,
          qualityScore: null,
          rank: null,
          result: null,
        },
        {
          channel: 'DRAW',
          decisionStatus: 'REJECTED',
          reasonCode: 'odds_below_floor',
          reasonDetails: null,
          market: null,
          pick: null,
          comboMarket: null,
          comboPick: null,
          probability: null,
          odds: null,
          ev: null,
          qualityScore: null,
          rank: null,
          result: null,
        },
      ],
    });

    const sheet = buildJsonSheet([f], meta);

    expect(sheet.fixtures[0]?.rejectionSummary).toEqual([
      {
        channel: 'DRAW',
        status: 'REJECTED',
        count: 3,
        topReasonCode: 'ev_below_threshold',
      },
    ]);
  });

  it('omits shadow signals when all are null, includes them when any is set', () => {
    const withoutShadow = buildJsonSheet(
      [fixture({ features: { predictionSource: 'POISSON_MAIN' } })],
      meta,
    );
    expect(withoutShadow.fixtures[0]?.model.shadowSignals).toBeNull();

    const withShadow = buildJsonSheet(
      [fixture({ features: { shadow_h2h: 0.05 } })],
      meta,
    );
    expect(withShadow.fixtures[0]?.model.shadowSignals).toEqual({
      lineMovement: null,
      h2h: 0.05,
      congestion: null,
    });
  });

  it('handles a fixture with no ModelRun features gracefully (NO_EVALUATION)', () => {
    const sheet = buildJsonSheet([fixture({ features: null })], meta);
    const [f] = sheet.fixtures;
    expect(f?.model.lambda).toBeNull();
    expect(f?.model.predictionSource).toBeNull();
    expect(f?.model.shadowSignals).toBeNull();
  });

  it('surfaces a triggered AVOID as a fixture-level flag (it appears in neither selectedPicks nor rejectionSummary)', () => {
    const f = fixture({
      selections: [
        {
          channel: 'SAFE',
          decisionStatus: 'SELECTED',
          reasonCode: null,
          reasonDetails: null,
          market: 'OVER_UNDER',
          pick: 'UNDER_3_5',
          comboMarket: null,
          comboPick: null,
          probability: 0.983,
          odds: 1.49,
          ev: 0.4646,
          qualityScore: 0.3472,
          rank: 1,
          result: null,
        },
        {
          channel: 'AVOID',
          decisionStatus: 'SELECTED',
          reasonCode: 'extreme_divergence',
          reasonDetails: {
            maxEdge: 0.3,
            offenders: [
              {
                channel: 'SAFE',
                market: 'OVER_UNDER',
                pick: 'UNDER_3_5',
                edge: 0.3119,
              },
            ],
          },
          market: null,
          pick: null,
          comboMarket: null,
          comboPick: null,
          probability: null,
          odds: null,
          ev: null,
          qualityScore: null,
          rank: null,
          result: null,
        },
      ],
    });

    const sheet = buildJsonSheet([f], meta);
    const [jsonFixture] = sheet.fixtures;

    expect(jsonFixture.avoidFlag).toEqual({
      reasonCode: 'extreme_divergence',
      maxEdge: 0.3,
      offenders: [
        {
          channel: 'SAFE',
          market: 'OVER_UNDER',
          pick: 'UNDER_3_5',
          edge: 0.3119,
        },
      ],
    });
    expect(sheet.summary.avoidedFixtureCount).toBe(1);
    // The AVOID meta-decision itself is neither a pick nor a rejection.
    expect(
      jsonFixture.selectedPicks.filter((p) => p.channel === 'AVOID'),
    ).toHaveLength(0);
    expect(
      jsonFixture.rejectionSummary.filter((r) => r.channel === 'AVOID'),
    ).toHaveLength(0);
  });

  it('leaves avoidFlag null when AVOID rejected (no_avoid_signal) and tolerates malformed reasonDetails', () => {
    const rejected = fixture({
      selections: [
        {
          channel: 'AVOID',
          decisionStatus: 'REJECTED',
          reasonCode: 'no_avoid_signal',
          reasonDetails: null,
          market: null,
          pick: null,
          comboMarket: null,
          comboPick: null,
          probability: null,
          odds: null,
          ev: null,
          qualityScore: null,
          rank: null,
          result: null,
        },
      ],
    });
    expect(buildJsonSheet([rejected], meta).fixtures[0]?.avoidFlag).toBeNull();
    expect(buildJsonSheet([rejected], meta).summary.avoidedFixtureCount).toBe(
      0,
    );

    const malformed = fixture({
      selections: [
        {
          channel: 'AVOID',
          decisionStatus: 'SELECTED',
          reasonCode: 'extreme_divergence',
          reasonDetails: { maxEdge: 'oops', offenders: [{ bad: true }, 42] },
          market: null,
          pick: null,
          comboMarket: null,
          comboPick: null,
          probability: null,
          odds: null,
          ev: null,
          qualityScore: null,
          rank: null,
          result: null,
        },
      ],
    });
    expect(buildJsonSheet([malformed], meta).fixtures[0]?.avoidFlag).toEqual({
      reasonCode: 'extreme_divergence',
      maxEdge: null,
      offenders: [],
    });
  });

  it('surfaces a calibration alert from ModelRun features and counts it in the summary', () => {
    const alertPayload = {
      reasons: ['extreme_divergence', 'favorite_flip'],
      modelFavorite: 'AWAY',
      marketFavorite: 'HOME',
      modelProbability: 0.38,
      medianImplied: 0.059,
      divergence: 0.321,
      bookmakerCount: 3,
    };
    const f = fixture({
      features: {
        predictionSource: 'POISSON_MAIN',
        calibration_alert: alertPayload,
      },
    });

    const sheet = buildJsonSheet([f], meta);
    expect(sheet.fixtures[0]?.calibrationAlert).toEqual(alertPayload);
    expect(sheet.summary.calibrationAlertCount).toBe(1);

    const txt = buildTxtSheet([f], meta);
    expect(txt).toContain('Alertes calibration : 1');
    expect(txt).toContain(
      '⚠ Calibration [extreme_divergence, favorite_flip] — favori modèle AWAY',
    );

    // Null when absent or malformed.
    const clean = buildJsonSheet([fixture({})], meta);
    expect(clean.fixtures[0]?.calibrationAlert).toBeNull();
    const malformed = buildJsonSheet(
      [fixture({ features: { calibration_alert: { reasons: 'oops' } } })],
      meta,
    );
    expect(malformed.fixtures[0]?.calibrationAlert).toBeNull();
  });

  it('handles an empty range with zero fixtures', () => {
    const sheet = buildJsonSheet([], meta);
    expect(sheet.summary.fixtureCount).toBe(0);
    expect(sheet.summary.byCompetition).toEqual({});
    expect(sheet.fixtures).toEqual([]);
  });
});

describe('buildTxtSheet', () => {
  it('renders a compact per-fixture block: header, model line, one line per pick, rejection rollup', () => {
    const f = fixture({
      selections: [
        {
          channel: 'VALUE',
          decisionStatus: 'SELECTED',
          reasonCode: null,
          reasonDetails: null,
          market: 'ONE_X_TWO',
          pick: 'HOME',
          comboMarket: null,
          comboPick: null,
          probability: 0.58,
          odds: 1.95,
          ev: 0.132,
          qualityScore: 0.812,
          rank: 1,
          result: 'WON',
        },
        {
          channel: 'DRAW',
          decisionStatus: 'REJECTED',
          reasonCode: 'probability_too_low',
          reasonDetails: null,
          market: null,
          pick: null,
          comboMarket: null,
          comboPick: null,
          probability: null,
          odds: null,
          ev: null,
          qualityScore: null,
          rank: null,
          result: null,
        },
      ],
    });

    const txt = buildTxtSheet([f], meta);

    expect(txt).toContain("FICHE D'ANALYSE EVCORE — 2026-06-20 -> 2026-06-27");
    expect(txt).toContain('Arsenal - Chelsea (PL)');
    expect(txt).toContain('Pick [EV]');
    expect(txt).toContain('V1');
    expect(txt).toContain('GAGNÉ');
    expect(txt).toContain('Rejets : NUL 1 (probability_too_low)');
    // never one line per rejected candidate — only the rollup line
    expect(txt.match(/Rejets :/g)).toHaveLength(1);
  });

  it('renders the AVOID warning with its offenders and the summary rollup', () => {
    const f = fixture({
      selections: [
        {
          channel: 'AVOID',
          decisionStatus: 'SELECTED',
          reasonCode: 'extreme_divergence',
          reasonDetails: {
            maxEdge: 0.3,
            offenders: [
              {
                channel: 'SAFE',
                market: 'OVER_UNDER',
                pick: 'UNDER_3_5',
                edge: 0.3119,
              },
            ],
          },
          market: null,
          pick: null,
          comboMarket: null,
          comboPick: null,
          probability: null,
          odds: null,
          ev: null,
          qualityScore: null,
          rank: null,
          result: null,
        },
      ],
    });

    const txt = buildTxtSheet([f], meta);

    expect(txt).toContain('Fixtures flaguées AVOID : 1');
    expect(txt).toContain(
      '⚠ AVOID [extreme_divergence] — divergence modèle/marché implausible (edge ≥ 0.30) ; picks exclus du staking',
    );
    expect(txt).toContain('Offender [SV]');
    expect(txt).toContain('edge +0.312');
  });

  it('produces a valid, non-crashing output for an empty fixture list', () => {
    const txt = buildTxtSheet([], meta);
    expect(txt).toContain('Aucune fixture sur cette période.');
  });

  it('renders a line-movement history for a pick that survived across rolling-horizon passes', () => {
    const f = fixture({
      selections: [
        {
          channel: 'VALUE',
          decisionStatus: 'SELECTED',
          reasonCode: null,
          reasonDetails: null,
          market: 'DOUBLE_CHANCE',
          pick: 'X2',
          comboMarket: null,
          comboPick: null,
          probability: 0.48,
          odds: 3.2,
          ev: 0.53,
          qualityScore: null,
          rank: 1,
          result: null,
        },
      ],
      priorPasses: [
        {
          modelRunId: 'mr-advance',
          analyzedAt: new Date('2026-06-30T14:19:30.000Z'),
          phase: 'ADVANCE',
          selectedPicks: [
            {
              channel: 'VALUE',
              decisionStatus: 'SELECTED',
              reasonCode: null,
              reasonDetails: null,
              market: 'DOUBLE_CHANCE',
              pick: 'X2',
              comboMarket: null,
              comboPick: null,
              probability: 0.44,
              odds: 3.5,
              ev: 0.53,
              qualityScore: null,
              rank: 1,
              result: null,
            },
          ],
        },
      ],
    });

    const json = buildJsonSheet([f], meta);
    const [pick] = json.fixtures[0].selectedPicks;
    expect(pick.history).toEqual([
      {
        analyzedAt: '2026-06-30T14:19:30.000Z',
        phase: 'ADVANCE',
        market: 'DOUBLE_CHANCE',
        pick: 'X2',
        probability: 0.44,
        odds: 3.5,
        ev: 0.53,
      },
    ]);

    const txt = buildTxtSheet([f], meta);
    expect(txt).toContain(
      'Historique [EV] (2 analyses) : 44.0%/3.50 → 48.0%/3.20',
    );
  });

  it('omits the history line when a channel had no earlier selected pick', () => {
    const f = fixture({
      selections: [
        {
          channel: 'VALUE',
          decisionStatus: 'SELECTED',
          reasonCode: null,
          reasonDetails: null,
          market: 'ONE_X_TWO',
          pick: 'HOME',
          comboMarket: null,
          comboPick: null,
          probability: 0.58,
          odds: 1.95,
          ev: 0.13,
          qualityScore: null,
          rank: 1,
          result: null,
        },
      ],
      priorPasses: [],
    });

    const txt = buildTxtSheet([f], meta);
    // The general explanatory note (header) mentions "Historique [canal]" as
    // a concept, but no per-pick history line should be emitted here.
    expect(txt).not.toMatch(/^\s*Historique \[/m);
  });
});
