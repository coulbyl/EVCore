import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CouponFavouriteGenerationService } from './coupon-favourite-generation.service';
import type { CouponRepository, PriceCandidateRow } from './coupon.repository';

const FOR_DATE = new Date('2026-10-13T00:00:00.000Z');

function row(overrides: Partial<PriceCandidateRow> = {}): PriceCandidateRow {
  return {
    fixtureId: 'f-1',
    competition: 'L1',
    market: 'ONE_X_TWO',
    pick: 'HOME',
    odds: 1.25,
    band: '<1.3',
    scheduledAt: new Date('2026-10-13T18:00:00.000Z'),
    ...overrides,
  };
}

function makeRepository() {
  return {
    findPriceCandidates: vi.fn<CouponRepository['findPriceCandidates']>(),
    upsertPriceComposerProposal:
      vi.fn<CouponRepository['upsertPriceComposerProposal']>(),
    recordPriceComposerAttempt:
      vi.fn<CouponRepository['recordPriceComposerAttempt']>(),
  };
}

describe('CouponFavouriteGenerationService', () => {
  let repository: ReturnType<typeof makeRepository>;
  let service: CouponFavouriteGenerationService;

  beforeEach(() => {
    repository = makeRepository();
    repository.upsertPriceComposerProposal.mockResolvedValue('proposal-1');
    repository.recordPriceComposerAttempt.mockResolvedValue();
    service = new CouponFavouriteGenerationService(
      repository as unknown as CouponRepository,
    );
  });

  it('writes a one-leg proposal on the shortest home favourite in band', async () => {
    repository.findPriceCandidates.mockResolvedValue([
      row({ fixtureId: 'f-2', odds: 1.3 }),
      row({ fixtureId: 'f-1', odds: 1.22 }),
      row({ fixtureId: 'f-3', odds: 1.05 }),
      row({ fixtureId: 'f-4', pick: 'AWAY', odds: 1.15 }),
    ]);

    const result = await service.generateForDate(FOR_DATE);

    expect(result).toEqual({
      outcome: 'composed',
      proposalId: 'proposal-1',
      candidateCount: 2,
    });
    const input = repository.upsertPriceComposerProposal.mock.calls[0]?.[0];
    expect(input?.legs).toHaveLength(1);
    expect(input?.legs[0]).toMatchObject({
      fixtureId: 'f-1',
      market: 'ONE_X_TWO',
      pick: 'HOME',
      odds: 1.22,
    });
    expect(input?.combinedOdds).toBe(1.22);
    expect(input?.profile).toEqual({
      targetOddsMin: 1.1,
      targetOddsMax: 1.35,
      policyVersion: 'favourite-v2',
    });
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'composed',
        pass: { name: 'favourite', policyVersion: 'favourite-v2' },
      }),
    );
  });

  it('abstains and records it when no home favourite is in band', async () => {
    repository.findPriceCandidates.mockResolvedValue([
      row({ odds: 1.05 }),
      row({ fixtureId: 'f-2', odds: 1.6 }),
    ]);

    const result = await service.generateForDate(FOR_DATE);

    expect(result).toEqual({
      outcome: 'abstained',
      reason: 'no_home_favourite_in_band',
      candidateCount: 0,
    });
    expect(repository.upsertPriceComposerProposal).not.toHaveBeenCalled();
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'abstained' }),
    );
  });
});
