import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayableOddsRepository } from '../betting-engine/pricing/playable-odds.repository';
import {
  CouponEngineComboGenerationService,
  ENGINE_LONG_PROFILE,
} from './coupon-engine-combo-generation.service';
import type {
  ChannelCompetitionCalibrationRow,
  CouponRepository,
  EngineComboCandidateRow,
} from './coupon.repository';

const FOR_DATE = new Date('2026-10-13T00:00:00.000Z');

function row(
  over: Partial<EngineComboCandidateRow> = {},
): EngineComboCandidateRow {
  return {
    fixtureId: 'f-1',
    competition: 'L1',
    channel: 'GOALS',
    market: 'OVER_UNDER',
    pick: 'OVER_1_5',
    odds: 1.2,
    probability: 0.8,
    scheduledAt: new Date('2026-10-13T18:00:00.000Z'),
    ...over,
  };
}
const cell = (
  over: Partial<ChannelCompetitionCalibrationRow> = {},
): ChannelCompetitionCalibrationRow => ({
  channel: 'GOALS',
  competition: 'L1',
  sampleSize: 120,
  ratio: 0.97,
  ...over,
});

function makeRepository() {
  return {
    findEngineComboCandidates:
      vi.fn<CouponRepository['findEngineComboCandidates']>(),
    findChannelCompetitionCalibration:
      vi.fn<CouponRepository['findChannelCompetitionCalibration']>(),
    upsertPriceComposerProposal:
      vi.fn<CouponRepository['upsertPriceComposerProposal']>(),
    recordPriceComposerAttempt:
      vi.fn<CouponRepository['recordPriceComposerAttempt']>(),
  };
}

describe('CouponEngineComboGenerationService', () => {
  let repository: ReturnType<typeof makeRepository>;
  let service: CouponEngineComboGenerationService;

  beforeEach(() => {
    repository = makeRepository();
    repository.upsertPriceComposerProposal.mockResolvedValue('proposal-1');
    repository.recordPriceComposerAttempt.mockResolvedValue();
    service = new CouponEngineComboGenerationService(
      repository as unknown as CouponRepository,
      {
        findPlayableQuotes: vi.fn().mockResolvedValue(new Map()),
      } as unknown as PlayableOddsRepository,
    );
  });

  it('writes an ENGINE proposal with two legs at 1.20 or more, each carrying its channel', async () => {
    repository.findEngineComboCandidates.mockResolvedValue([
      row({ fixtureId: 'a', odds: 1.3 }),
      row({ fixtureId: 'b', odds: 1.21, competition: 'PL' }),
      row({
        fixtureId: 'c',
        odds: 1.25,
        competition: 'SA',
        channel: 'DOUBLE_CHANCE',
      }),
      row({ fixtureId: 'd', odds: 1.9 }),
    ]);
    repository.findChannelCompetitionCalibration.mockResolvedValue([
      cell(),
      cell({ competition: 'PL' }),
      cell({ competition: 'SA', channel: 'DOUBLE_CHANCE' }),
    ]);

    const result = await service.generateForDate(FOR_DATE);

    expect(result).toMatchObject({
      outcome: 'composed',
      proposalId: 'proposal-1',
    });
    const input = repository.upsertPriceComposerProposal.mock.calls[0]?.[0];
    expect(input?.legs.map((l) => l.fixtureId)).toEqual(['b', 'c']);
    expect(input?.legs[1]?.canal).toBe('DOUBLE_CHANCE');
    expect(input?.combinedOdds).toBeCloseTo(1.21 * 1.25, 6);
    expect(input?.profile).toMatchObject({
      source: 'ENGINE',
      targetOddsMin: 1.2,
      policyVersion: 'engine-combo-v1',
    });
    expect(repository.findChannelCompetitionCalibration).toHaveBeenCalledWith(
      new Date('2026-07-15T00:00:00.000Z'),
    );
  });

  it('abstains and records it when fewer than two calibrated legs at 1.20 or more exist', async () => {
    repository.findEngineComboCandidates.mockResolvedValue([
      row({ fixtureId: 'a' }),
      // Sous le plancher de 1,20 : jamais éligible.
      row({ fixtureId: 'b', odds: 1.1, competition: 'PL' }),
    ]);
    repository.findChannelCompetitionCalibration.mockResolvedValue([cell()]);

    const result = await service.generateForDate(FOR_DATE);

    expect(result).toMatchObject({ outcome: 'abstained', candidateCount: 1 });
    expect(repository.upsertPriceComposerProposal).not.toHaveBeenCalled();
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'abstained',
        pass: { name: 'engine-combo', policyVersion: 'engine-combo-v1' },
      }),
    );
  });

  it('composes the long coupon longest-first to the 2.5 target under the LONG class', async () => {
    repository.findEngineComboCandidates.mockResolvedValue([
      row({ fixtureId: 'a', odds: 1.7 }),
      row({ fixtureId: 'b', odds: 1.75, competition: 'PL' }),
      row({ fixtureId: 'c', odds: 1.3, competition: 'SA' }),
    ]);
    repository.findChannelCompetitionCalibration.mockResolvedValue([
      cell(),
      cell({ competition: 'PL' }),
      cell({ competition: 'SA' }),
    ]);

    const result = await service.generateForDate(FOR_DATE, ENGINE_LONG_PROFILE);

    expect(result).toMatchObject({ outcome: 'composed' });
    const input = repository.upsertPriceComposerProposal.mock.calls[0]?.[0];
    expect(input?.legs.map((l) => l.fixtureId)).toEqual(['b', 'a']);
    expect(input?.combinedOdds).toBeCloseTo(1.75 * 1.7, 6);
    expect(input?.profile).toMatchObject({
      source: 'ENGINE',
      targetOddsMin: 2.5,
      targetOddsMax: 5,
      policyVersion: 'engine-long-v1',
    });
  });
});
