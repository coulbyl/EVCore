import { describe, expect, it } from 'vitest';
import { resolveEvaCoupons } from './analysis-sheet.coupons';
import type {
  AnalysisSheetJson,
  AnalysisSheetJsonFixture,
  AnalysisSheetJsonPick,
} from './analysis-sheet.render';

function pick(
  overrides: Partial<AnalysisSheetJsonPick> = {},
): AnalysisSheetJsonPick {
  return {
    channel: 'SAFE',
    market: 'ONE_X_TWO',
    pick: 'HOME',
    probability: 0.9,
    odds: 1.5,
    ev: 0.35,
    qualityScore: 0.23,
    rank: 1,
    result: null,
    observationOnly: false,
    // Two prior snapshots by default so the happy-path tests clear the
    // minHistorySnapshots gate; individual tests override to `[]` to
    // exercise the insufficient_history rejection.
    history: [
      {
        analyzedAt: '2026-07-01T16:00:00.000Z',
        phase: 'ADVANCE',
        market: 'ONE_X_TWO',
        pick: 'HOME',
        probability: 0.88,
        odds: 1.55,
        ev: 0.32,
      },
      {
        analyzedAt: '2026-07-02T16:00:00.000Z',
        phase: 'ADVANCE',
        market: 'ONE_X_TWO',
        pick: 'HOME',
        probability: 0.89,
        odds: 1.52,
        ev: 0.34,
      },
    ],
    adjustmentDelta: null,
    evMarginToThreshold: 0.27,
    ...overrides,
  };
}

function fixture(
  overrides: Partial<AnalysisSheetJsonFixture> = {},
): AnalysisSheetJsonFixture {
  return {
    fixtureId: 'fx-1',
    match: 'Kongsvinger - Sogndal',
    competition: 'NOR2',
    kickoff: '2026-07-03T16:00:00.000Z',
    status: 'SCHEDULED',
    score: null,
    model: {
      deterministicScore: 0.66,
      finalScore: 0.66,
      scoreThreshold: 0.6,
      predictionSource: 'POISSON_MAIN',
      lambda: null,
      shadowSignals: null,
      dataCoverage: 0,
      shadowPredictions: null,
    },
    avoidFlag: null,
    calibrationAlert: null,
    selectedPicks: [pick()],
    rejectionSummary: [],
    ...overrides,
  };
}

function sheet(fixtures: AnalysisSheetJsonFixture[]): AnalysisSheetJson {
  return {
    generatedAt: '2026-07-03T16:00:00.000Z',
    range: { from: '2026-07-03', to: '2026-07-10' },
    filters: { competitionCode: null, channel: null },
    summary: {
      fixtureCount: fixtures.length,
      avoidedFixtureCount: 0,
      calibrationAlertCount: 0,
      byCompetition: {},
      byChannel: {},
      settledRecord: {
        playable: { won: 0, lost: 0, pending: 0, void: 0 },
        observation: { won: 0, lost: 0, pending: 0, void: 0 },
      },
    },
    fixtures,
  };
}

function analysisWithBlock(block: object): string {
  return `**Analyse**\n\nTexte.\n\n\`\`\`evcore-coupons\n${JSON.stringify(block)}\n\`\`\``;
}

const twoLegSheet = sheet([
  fixture({ fixtureId: 'fx-1' }),
  fixture({
    fixtureId: 'fx-2',
    match: 'Shenyang Urban - Chongqing',
    competition: 'CSL',
    selectedPicks: [
      pick({
        channel: 'GOALS',
        market: 'OVER_UNDER',
        pick: 'OVER',
        odds: 1.32,
        ev: 0.18,
        probability: 0.895,
      }),
    ],
  }),
]);

const twoLegProposal = {
  coupons: [
    {
      label: 'Solide',
      legs: [
        { fixtureId: 'fx-1', channel: 'SAFE' },
        { fixtureId: 'fx-2', channel: 'GOALS' },
      ],
    },
  ],
};

describe('resolveEvaCoupons', () => {
  it('resolves legs against the sheet and prices the coupon with backend arithmetic', () => {
    const resolved = resolveEvaCoupons({
      rawAnalysis: analysisWithBlock(twoLegProposal),
      sheet: twoLegSheet,
      targetWinAmount: 300_000,
    });

    expect(resolved.droppedCoupons).toEqual([]);
    expect(resolved.coupons).toHaveLength(1);
    const [coupon] = resolved.coupons;
    expect(coupon.label).toBe('Solide');
    expect(coupon.legs.map((l) => l.match)).toEqual([
      'Kongsvinger - Sogndal',
      'Shenyang Urban - Chongqing',
    ]);
    // Odds come from the sheet, never from the LLM: 1.5 × 1.32 = 1.98.
    expect(coupon.totalOdds).toBe(1.98);
    // stake = 300000 / 0.98 = 306122.4 → rounded UP to 306200.
    expect(coupon.stake).toBe(306_200);
    expect(coupon.potentialPayout).toBe(606_276);
    expect(coupon.netGain).toBe(300_076);
    expect(coupon.netGain!).toBeGreaterThanOrEqual(300_000);
  });

  it('strips the technical block from the analysis text', () => {
    const resolved = resolveEvaCoupons({
      rawAnalysis: analysisWithBlock(twoLegProposal),
      sheet: twoLegSheet,
    });
    expect(resolved.analysis).toContain('**Analyse**');
    expect(resolved.analysis).not.toContain('evcore-coupons');
    expect(resolved.analysis).not.toContain('fx-1');
  });

  it('leaves stake/payout null when no target win amount is given', () => {
    const resolved = resolveEvaCoupons({
      rawAnalysis: analysisWithBlock(twoLegProposal),
      sheet: twoLegSheet,
    });
    const [coupon] = resolved.coupons;
    expect(coupon.totalOdds).toBe(1.98);
    expect(coupon.stake).toBeNull();
    expect(coupon.potentialPayout).toBeNull();
    expect(coupon.netGain).toBeNull();
  });

  it('returns no coupons when the block is absent or malformed, analysis untouched', () => {
    const noBlock = resolveEvaCoupons({
      rawAnalysis: 'Analyse sans bloc.',
      sheet: twoLegSheet,
    });
    expect(noBlock.analysis).toBe('Analyse sans bloc.');
    expect(noBlock.coupons).toEqual([]);

    const malformed = resolveEvaCoupons({
      rawAnalysis: '```evcore-coupons\n{not json}\n```',
      sheet: twoLegSheet,
    });
    expect(malformed.coupons).toEqual([]);
    expect(malformed.droppedCoupons).toEqual([]);
  });

  const dropCases: {
    name: string;
    reasonCode: string;
    fixtures: AnalysisSheetJsonFixture[];
    legs?: { fixtureId: string; channel: string }[];
  }[] = [
    {
      name: 'unknown fixture',
      reasonCode: 'unknown_fixture',
      fixtures: [fixture()],
      legs: [
        { fixtureId: 'fx-1', channel: 'SAFE' },
        { fixtureId: 'fx-ghost', channel: 'SAFE' },
      ],
    },
    {
      name: 'settled fixture',
      reasonCode: 'fixture_settled',
      fixtures: [
        fixture(),
        fixture({ fixtureId: 'fx-2', status: 'FINISHED', score: '2-1' }),
      ],
    },
    {
      name: 'flagged fixture (AVOID or calibration)',
      reasonCode: 'fixture_flagged',
      fixtures: [
        fixture(),
        fixture({
          fixtureId: 'fx-2',
          avoidFlag: {
            reasonCode: 'extreme_divergence',
            maxEdge: 0.3,
            offenders: [],
          },
        }),
      ],
    },
    {
      name: 'channel with no selected pick',
      reasonCode: 'unknown_pick',
      fixtures: [fixture(), fixture({ fixtureId: 'fx-2' })],
      legs: [
        { fixtureId: 'fx-1', channel: 'SAFE' },
        { fixtureId: 'fx-2', channel: 'BTTS' },
      ],
    },
    {
      name: 'observation-only CORRECT_SCORE pick',
      reasonCode: 'observation_only',
      fixtures: [
        fixture(),
        fixture({
          fixtureId: 'fx-2',
          selectedPicks: [
            pick({
              channel: 'CORRECT_SCORE',
              market: 'CORRECT_SCORE',
              pick: '3:0',
              ev: 1.25,
              observationOnly: true,
            }),
          ],
        }),
      ],
      legs: [
        { fixtureId: 'fx-1', channel: 'SAFE' },
        { fixtureId: 'fx-2', channel: 'CORRECT_SCORE' },
      ],
    },
    {
      name: 'EV below the 0.08 threshold',
      reasonCode: 'ev_below_threshold',
      fixtures: [
        fixture(),
        fixture({
          fixtureId: 'fx-2',
          selectedPicks: [pick({ ev: 0.079 })],
        }),
      ],
    },
    {
      name: 'pick with fewer than minHistorySnapshots prior passes',
      reasonCode: 'insufficient_history',
      fixtures: [
        fixture(),
        fixture({
          fixtureId: 'fx-2',
          selectedPicks: [pick({ history: [] })],
        }),
      ],
    },
    {
      name: 'two legs on the same fixture',
      reasonCode: 'duplicate_fixture',
      fixtures: [fixture()],
      legs: [
        { fixtureId: 'fx-1', channel: 'SAFE' },
        { fixtureId: 'fx-1', channel: 'SAFE' },
      ],
    },
  ];

  for (const c of dropCases) {
    it(`drops the whole coupon on ${c.name}`, () => {
      const legs =
        c.legs ??
        c.fixtures.map((f) => ({ fixtureId: f.fixtureId, channel: 'SAFE' }));
      const resolved = resolveEvaCoupons({
        rawAnalysis: analysisWithBlock({
          coupons: [{ label: 'Test', legs }],
        }),
        sheet: sheet(c.fixtures),
        targetWinAmount: 100_000,
      });
      expect(resolved.coupons).toEqual([]);
      expect(resolved.droppedCoupons).toEqual([
        { label: 'Test', reasonCode: c.reasonCode },
      ]);
    });
  }

  it('drops coupons with fewer than 2 or more than 5 legs', () => {
    const single = resolveEvaCoupons({
      rawAnalysis: analysisWithBlock({
        coupons: [
          { label: 'Solo', legs: [{ fixtureId: 'fx-1', channel: 'SAFE' }] },
        ],
      }),
      sheet: twoLegSheet,
    });
    expect(single.droppedCoupons).toEqual([
      { label: 'Solo', reasonCode: 'leg_count_out_of_bounds' },
    ]);
  });

  it('keeps at most 3 coupons', () => {
    const proposal = {
      coupons: [1, 2, 3, 4].map((n) => ({
        label: `C${n}`,
        legs: [
          { fixtureId: 'fx-1', channel: 'SAFE' },
          { fixtureId: 'fx-2', channel: 'GOALS' },
        ],
      })),
    };
    const resolved = resolveEvaCoupons({
      rawAnalysis: analysisWithBlock(proposal),
      sheet: twoLegSheet,
    });
    expect(resolved.coupons.map((c) => c.label)).toEqual(['C1', 'C2', 'C3']);
  });

  it('labels legs with the French pick vocabulary from the sheet', () => {
    const resolved = resolveEvaCoupons({
      rawAnalysis: analysisWithBlock(twoLegProposal),
      sheet: twoLegSheet,
    });
    const labels = resolved.coupons[0].legs.map((l) => l.pickLabel);
    expect(labels).toEqual(['Victoire domicile', 'Plus de 2.5 buts']);
  });
});
