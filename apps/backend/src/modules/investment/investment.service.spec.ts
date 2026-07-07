import { describe, expect, it, vi } from 'vitest';
import type {
  ChannelDecisionChannelGroup,
  ChannelDecisionItem,
  ChannelDecisionService,
  ChannelSelectionItem,
} from '@modules/betting-engine/channel-decision.service';
import type {
  ChannelCalibration,
  InvestmentCalibrationRepository,
} from './investment-calibration.repository';
import type {
  InvestmentCoherenceRepository,
  LambdaTotals,
} from './investment-coherence.repository';
import { INVESTMENT_LIMITS } from './investment.constants';
import { InvestmentService } from './investment.service';

function selection(
  overrides: Partial<ChannelSelectionItem> = {},
): ChannelSelectionItem {
  return {
    market: 'ONE_X_TWO',
    pick: 'HOME',
    comboMarket: null,
    comboPick: null,
    probability: 0.7,
    odds: 1.5,
    impliedProbability: 0.66,
    ev: 0.06,
    qualityScore: 0.04,
    rank: 1,
    result: null,
    ...overrides,
  };
}

function item(
  overrides: Partial<ChannelDecisionItem> = {},
): ChannelDecisionItem {
  return {
    id: 'decision-1',
    fixtureId: 'fx-1',
    modelRunId: 'run-1',
    competition: 'PL',
    competitionName: 'Premier League',
    country: 'England',
    homeTeam: 'Home FC',
    awayTeam: 'Away FC',
    homeLogo: null,
    awayLogo: null,
    kickoff: '18:00',
    scheduledAt: '2026-07-06T18:00:00.000Z',
    score: null,
    htScore: null,
    phase: 'ADVANCE',
    channel: 'VALUE',
    status: 'SELECTED',
    reasonCode: null,
    reasonDetails: null,
    calibrationAlert: false,
    selections: [selection()],
    ...overrides,
  };
}

function group(
  channel: ChannelDecisionChannelGroup['channel'],
  decisions: ChannelDecisionItem[],
): ChannelDecisionChannelGroup {
  return { channel, decisions };
}

function makeService(
  groups: ChannelDecisionChannelGroup[],
  calibration: ChannelCalibration = {},
  lambdaTotals: LambdaTotals = new Map(),
) {
  const channelDecisions = {
    listByChannel: vi.fn().mockResolvedValue(groups),
  } as unknown as ChannelDecisionService;
  const calibrationRepository = {
    computeMeanError: vi.fn().mockResolvedValue(calibration),
  } as unknown as InvestmentCalibrationRepository;
  const coherenceRepository = {
    findLambdaTotals: vi.fn().mockResolvedValue(lambdaTotals),
  } as unknown as InvestmentCoherenceRepository;
  return new InvestmentService(
    channelDecisions,
    calibrationRepository,
    coherenceRepository,
  );
}

describe('InvestmentService.listBestPicks', () => {
  it('ranks by probability bucket first, then probability within the bucket', async () => {
    const service = makeService([
      group('VALUE', [
        item({
          fixtureId: 'fx-solid',
          selections: [selection({ probability: 0.7 })],
        }),
      ]),
      group('SAFE', [
        item({
          fixtureId: 'fx-very-likely-lower',
          channel: 'SAFE',
          selections: [selection({ probability: 0.82 })],
        }),
        item({
          fixtureId: 'fx-very-likely-higher',
          channel: 'SAFE',
          selections: [selection({ probability: 0.95 })],
        }),
      ]),
    ]);

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks.map((p) => p.fixtureId)).toEqual([
      'fx-very-likely-higher',
      'fx-very-likely-lower',
      'fx-solid',
    ]);
    expect(picks[0]?.probabilityBucket).toBe('veryLikely');
    expect(picks[2]?.probabilityBucket).toBe('solid');
  });

  it('corrects the displayed probability and bucket by the measured per-channel bias', async () => {
    const service = makeService(
      [
        group('SAFE', [
          item({
            fixtureId: 'fx-overconfident-safe',
            channel: 'SAFE',
            selections: [selection({ probability: 0.87 })],
          }),
        ]),
      ],
      { SAFE: 0.125 },
    );

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks).toHaveLength(1);
    expect(picks[0]?.modelProbability).toBe(0.87);
    expect(picks[0]?.probability).toBeCloseTo(0.745, 5);
    expect(picks[0]?.probabilityBucket).toBe('solid');
  });

  it('leaves probability unchanged for a channel with no measured bias', async () => {
    const service = makeService(
      [
        group('DRAW', [
          item({
            fixtureId: 'fx-draw',
            channel: 'DRAW',
            selections: [selection({ probability: 0.6 })],
          }),
        ]),
      ],
      { SAFE: 0.125 },
    );

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks[0]?.modelProbability).toBe(0.6);
    expect(picks[0]?.probability).toBe(0.6);
  });

  it('excludes a GOALS Under 2.5 pick when the model lambda contradicts it', async () => {
    const service = makeService(
      [
        group('GOALS', [
          item({
            fixtureId: 'fx-incoherent-under',
            modelRunId: 'run-incoherent',
            channel: 'GOALS',
            selections: [
              selection({
                market: 'OVER_UNDER',
                pick: 'UNDER',
                probability: 0.5,
              }),
            ],
          }),
        ]),
      ],
      {},
      new Map([['run-incoherent', 3.6]]), // lambda total 3.6 > the 2.5 line
    );

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks).toEqual([]);
  });

  it('keeps a GOALS Under 2.5 pick when the model lambda agrees with it', async () => {
    const service = makeService(
      [
        group('GOALS', [
          item({
            fixtureId: 'fx-coherent-under',
            modelRunId: 'run-coherent',
            channel: 'GOALS',
            selections: [
              selection({
                market: 'OVER_UNDER',
                pick: 'UNDER',
                probability: 0.5,
              }),
            ],
          }),
        ]),
      ],
      {},
      new Map([['run-coherent', 2.1]]), // lambda total 2.1 <= the 2.5 line
    );

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks).toHaveLength(1);
  });

  it('does not apply the lambda-coherence check to non-GOALS channels', async () => {
    const service = makeService(
      [
        group('VALUE', [
          item({
            fixtureId: 'fx-value-over-under',
            modelRunId: 'run-value',
            channel: 'VALUE',
            selections: [
              selection({
                market: 'OVER_UNDER',
                pick: 'UNDER',
                probability: 0.5,
              }),
            ],
          }),
        ]),
      ],
      {},
      new Map([['run-value', 3.6]]),
    );

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks).toHaveLength(1);
  });

  it('does not exclude a high-probability pick with negative EV', async () => {
    const service = makeService([
      group('SAFE', [
        item({
          fixtureId: 'fx-safe-negative-ev',
          channel: 'SAFE',
          selections: [selection({ probability: 0.92, odds: 1.05, ev: -0.03 })],
        }),
      ]),
    ]);

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks).toHaveLength(1);
    expect(picks[0]?.ev).toBe(-0.03);
    expect(picks[0]?.evSign).toBe('negative');
  });

  it('flags short odds and negative-ROI channels without excluding the pick', async () => {
    const service = makeService([
      group('BTTS', [
        item({
          fixtureId: 'fx-btts',
          channel: 'BTTS',
          selections: [selection({ probability: 0.66, odds: 1.15, ev: -0.05 })],
        }),
      ]),
    ]);

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks).toHaveLength(1);
    expect(picks[0]?.shortOdds).toBe(true);
    expect(picks[0]?.channelRoiFlag).toBe(true);
  });

  it('includes speculative (sub-50%) picks with the correct bucket, never excluded', async () => {
    const service = makeService([
      group('GOALS', [
        item({
          fixtureId: 'fx-speculative',
          channel: 'GOALS',
          selections: [selection({ probability: 0.44, ev: 0.09 })],
        }),
      ]),
    ]);

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks).toHaveLength(1);
    expect(picks[0]?.probabilityBucket).toBe('speculative');
  });

  it('keeps already-played fixtures with their score and result (past-date review)', async () => {
    const service = makeService([
      group('VALUE', [
        item({
          fixtureId: 'fx-finished',
          score: '2-1',
          selections: [selection({ result: 'WON' })],
        }),
      ]),
    ]);

    const picks = await service.listBestPicks({ date: '2026-07-01' });

    expect(picks).toHaveLength(1);
    expect(picks[0]?.score).toBe('2-1');
    expect(picks[0]?.result).toBe('WON');
  });

  it('excludes fixtures with a calibration alert', async () => {
    const service = makeService([
      group('VALUE', [
        item({ fixtureId: 'fx-calibration', calibrationAlert: true }),
      ]),
    ]);

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks).toEqual([]);
  });

  it('excludes fixtures flagged by AVOID', async () => {
    const service = makeService([
      group('VALUE', [item({ fixtureId: 'fx-avoided' })]),
      group('AVOID', [
        item({
          fixtureId: 'fx-avoided',
          channel: 'AVOID',
          selections: [],
        }),
      ]),
    ]);

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks).toEqual([]);
  });

  it('excludes CORRECT_SCORE and other non-investment channels', async () => {
    const service = makeService([
      group('CORRECT_SCORE' as ChannelDecisionChannelGroup['channel'], [
        item({
          fixtureId: 'fx-correct-score',
          channel: 'CORRECT_SCORE' as ChannelDecisionItem['channel'],
        }),
      ]),
    ]);

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks).toEqual([]);
  });

  it('drops picks with no real odds', async () => {
    const service = makeService([
      group('VALUE', [
        item({
          fixtureId: 'fx-no-odds',
          selections: [selection({ odds: null })],
        }),
      ]),
    ]);

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks).toEqual([]);
  });

  it('caps the result at INVESTMENT_LIMITS.maxPicks', async () => {
    const decisions = Array.from(
      { length: INVESTMENT_LIMITS.maxPicks + 5 },
      (_, i) =>
        item({
          fixtureId: `fx-${i}`,
          selections: [selection({ probability: 0.5 + i * 0.001 })],
        }),
    );
    const service = makeService([group('VALUE', decisions)]);

    const picks = await service.listBestPicks({ date: '2026-07-06' });

    expect(picks).toHaveLength(INVESTMENT_LIMITS.maxPicks);
  });

  describe('mode: "value"', () => {
    it('restricts to VALUE only (not SAFE, not other channels)', async () => {
      const service = makeService([
        group('VALUE', [
          item({
            fixtureId: 'fx-value',
            selections: [selection({ ev: 0.2, probability: 0.6 })],
          }),
        ]),
        group('SAFE', [
          item({
            fixtureId: 'fx-safe',
            channel: 'SAFE',
            selections: [selection({ ev: 0.1, probability: 0.7 })],
          }),
        ]),
        group('GOALS', [
          item({
            fixtureId: 'fx-goals',
            channel: 'GOALS',
            selections: [
              selection({
                market: 'OVER_UNDER',
                pick: 'OVER',
                ev: 0.3,
                probability: 0.55,
              }),
            ],
          }),
        ]),
      ]);

      const picks = await service.listBestPicks({
        date: '2026-07-06',
        mode: 'value',
      });

      expect(picks.map((p) => p.channel)).toEqual(['VALUE']);
    });

    it('excludes picks below the EV threshold', async () => {
      const service = makeService([
        group('VALUE', [
          item({
            fixtureId: 'fx-below-threshold',
            selections: [selection({ ev: 0.05 })],
          }),
        ]),
      ]);

      const picks = await service.listBestPicks({
        date: '2026-07-06',
        mode: 'value',
      });

      expect(picks).toEqual([]);
    });

    it('ranks by EV descending instead of probability bucket', async () => {
      const service = makeService([
        group('VALUE', [
          item({
            fixtureId: 'fx-high-prob-low-ev',
            selections: [selection({ ev: 0.09, probability: 0.9, odds: 1.11 })],
          }),
          item({
            fixtureId: 'fx-lower-prob-high-ev',
            selections: [selection({ ev: 0.53, probability: 0.6, odds: 2.0 })],
          }),
        ]),
      ]);

      const picks = await service.listBestPicks({
        date: '2026-07-06',
        mode: 'value',
      });

      expect(picks.map((p) => p.fixtureId)).toEqual([
        'fx-lower-prob-high-ev',
        'fx-high-prob-low-ev',
      ]);
    });

    it('defaults to "probability" mode when mode is omitted', async () => {
      const service = makeService([
        group('GOALS', [
          item({
            fixtureId: 'fx-goals-default',
            channel: 'GOALS',
            selections: [
              selection({ market: 'OVER_UNDER', pick: 'OVER', ev: -0.1 }),
            ],
          }),
        ]),
      ]);

      const picks = await service.listBestPicks({ date: '2026-07-06' });

      expect(picks).toHaveLength(1);
    });
  });

  describe('mode: "safe"', () => {
    it('restricts to SAFE only', async () => {
      const service = makeService([
        group('SAFE', [
          item({
            fixtureId: 'fx-safe',
            channel: 'SAFE',
            selections: [selection({ probability: 0.85, ev: -0.02 })],
          }),
        ]),
        group('VALUE', [
          item({
            fixtureId: 'fx-value',
            selections: [selection({ ev: 0.2, probability: 0.6 })],
          }),
        ]),
      ]);

      const picks = await service.listBestPicks({
        date: '2026-07-06',
        mode: 'safe',
      });

      expect(picks.map((p) => p.channel)).toEqual(['SAFE']);
    });

    it('does not apply an EV floor — a negative-EV SAFE pick still shows', async () => {
      const service = makeService([
        group('SAFE', [
          item({
            fixtureId: 'fx-safe-negative-ev',
            channel: 'SAFE',
            selections: [selection({ probability: 0.9, ev: -0.05 })],
          }),
        ]),
      ]);

      const picks = await service.listBestPicks({
        date: '2026-07-06',
        mode: 'safe',
      });

      expect(picks).toHaveLength(1);
      expect(picks[0]?.evSign).toBe('negative');
    });

    it('ranks by probability bucket, like probability mode', async () => {
      const service = makeService([
        group('SAFE', [
          item({
            fixtureId: 'fx-safe-lower',
            channel: 'SAFE',
            selections: [selection({ probability: 0.7 })],
          }),
          item({
            fixtureId: 'fx-safe-higher',
            channel: 'SAFE',
            selections: [selection({ probability: 0.95 })],
          }),
        ]),
      ]);

      const picks = await service.listBestPicks({
        date: '2026-07-06',
        mode: 'safe',
      });

      expect(picks.map((p) => p.fixtureId)).toEqual([
        'fx-safe-higher',
        'fx-safe-lower',
      ]);
    });
  });

  describe.each([
    ['dominant', 'DOMINANT'] as const,
    ['btts', 'BTTS'] as const,
    ['goals', 'GOALS'] as const,
    ['draw', 'DRAW'] as const,
  ])('mode: "%s"', (mode, channel) => {
    it(`restricts to ${channel} only and ranks by probability`, async () => {
      const service = makeService([
        group(channel, [
          item({
            fixtureId: `fx-${mode}-lower`,
            channel,
            selections: [
              selection({
                market: channel === 'GOALS' ? 'OVER_UNDER' : 'ONE_X_TWO',
                pick: channel === 'GOALS' ? 'OVER' : 'HOME',
                probability: 0.6,
              }),
            ],
          }),
          item({
            fixtureId: `fx-${mode}-higher`,
            channel,
            selections: [
              selection({
                market: channel === 'GOALS' ? 'OVER_UNDER' : 'ONE_X_TWO',
                pick: channel === 'GOALS' ? 'OVER' : 'HOME',
                probability: 0.9,
              }),
            ],
          }),
        ]),
        group('VALUE', [
          item({
            fixtureId: 'fx-value-noise',
            selections: [selection({ ev: 0.5, probability: 0.99 })],
          }),
        ]),
      ]);

      const picks = await service.listBestPicks({ date: '2026-07-06', mode });

      expect(picks.map((p) => p.channel)).toEqual([channel, channel]);
      expect(picks.map((p) => p.fixtureId)).toEqual([
        `fx-${mode}-higher`,
        `fx-${mode}-lower`,
      ]);
    });
  });
});
