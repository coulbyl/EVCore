import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CouponDoubleGenerationService } from './coupon-double-generation.service';
import { CouponPricedPoolService } from './coupon-priced-pool.service';
import type {
  PlayableOddsRepository,
  PlayableQuote,
} from '../betting-engine/pricing/playable-odds.repository';
import type { CouponRepository, PriceCandidateRow } from './coupon.repository';

const FOR_DATE = new Date('2026-10-29T00:00:00.000Z');

function overUnder(
  fixtureId: string,
  over: number,
  under: number,
): PriceCandidateRow[] {
  const base = {
    fixtureId,
    competition: 'L1',
    market: 'OVER_UNDER',
    band: '',
    scheduledAt: new Date(
      `2026-10-29T${fixtureId === 'f-2' ? '20' : '18'}:00:00.000Z`,
    ),
  };
  return [
    { ...base, pick: 'OVER_1_5', odds: over },
    { ...base, pick: 'UNDER_1_5', odds: under },
  ];
}

function makeRepository() {
  return {
    findDoubleCandidates: vi.fn<CouponRepository['findDoubleCandidates']>(),
    upsertPriceComposerProposal:
      vi.fn<CouponRepository['upsertPriceComposerProposal']>(),
    recordPriceComposerAttempt:
      vi.fn<CouponRepository['recordPriceComposerAttempt']>(),
  };
}

describe('CouponDoubleGenerationService', () => {
  let repository: ReturnType<typeof makeRepository>;
  let quotes: Map<string, PlayableQuote>;
  let service: CouponDoubleGenerationService;

  beforeEach(() => {
    repository = makeRepository();
    repository.upsertPriceComposerProposal.mockResolvedValue('proposal-1');
    repository.recordPriceComposerAttempt.mockResolvedValue();
    quotes = new Map();
    const playable = {
      findPlayableQuotes: vi
        .fn()
        .mockImplementation(() => Promise.resolve(quotes)),
    } as unknown as PlayableOddsRepository;
    service = new CouponDoubleGenerationService(
      repository as unknown as CouponRepository,
      new CouponPricedPoolService(
        repository as unknown as CouponRepository,
        playable,
      ),
    );
  });

  it('writes a two-leg 2–3 proposal announcing the market probability', async () => {
    const rows = [
      ...overUnder('f-1', 1.45, 2.65),
      ...overUnder('f-2', 1.45, 2.65),
    ];
    repository.findDoubleCandidates.mockResolvedValue(rows);
    // 1xBet cote chaque issue au prix de référence : jambes jouables.
    for (const row of rows) {
      quotes.set(`${row.fixtureId}|${row.market}|${row.pick}`, {
        fixtureId: row.fixtureId,
        market: row.market,
        pick: row.pick,
        operatorOdds: row.odds,
        operatorBookmaker: '1xBet',
        operatorMargin: null,
        operatorFairProbability: null,
        lowestOdds: row.odds,
        lowestBookmaker: '1xBet',
      });
    }

    const result = await service.generateForDate(FOR_DATE);

    expect(result).toEqual({
      outcome: 'composed',
      proposalId: 'proposal-1',
      candidateCount: 2,
    });
    const [input] = repository.upsertPriceComposerProposal.mock.calls[0];
    expect(input.profile).toMatchObject({
      targetOddsMin: 2,
      targetOddsMax: 3,
      policyVersion: 'double-market-v1',
    });
    expect(input.legs).toHaveLength(2);
    // Probabilité du marché : 0,6897 / (0,6897 + 0,3774) = 0,6463 par jambe.
    expect(input.legs[0]?.probability).toBeCloseTo(0.6463, 3);
    expect(input.expectedReturn / input.combinedOdds).toBeCloseTo(
      0.6463 ** 2,
      3,
    );
    expect(input.lastFixtureScheduledAt.toISOString()).toBe(
      '2026-10-29T20:00:00.000Z',
    );
  });

  it("reads the window on 1xBet's price and abstains when it falls short", async () => {
    repository.findDoubleCandidates.mockResolvedValue([
      ...overUnder('f-1', 1.45, 2.65),
      ...overUnder('f-2', 1.45, 2.65),
    ]);
    for (const fixtureId of ['f-1', 'f-2']) {
      quotes.set(`${fixtureId}|OVER_UNDER|OVER_1_5`, {
        fixtureId,
        market: 'OVER_UNDER',
        pick: 'OVER_1_5',
        operatorOdds: 1.38,
        operatorBookmaker: '1xBet',
        operatorMargin: null,
        operatorFairProbability: null,
        lowestOdds: 1.38,
        lowestBookmaker: '1xBet',
      });
    }

    const result = await service.generateForDate(FOR_DATE);

    expect(result).toMatchObject({
      outcome: 'abstained',
      reason: 'no_combination_in_window',
    });
    expect(repository.upsertPriceComposerProposal).not.toHaveBeenCalled();
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'abstained',
        pass: { name: 'double', policyVersion: 'double-market-v1' },
      }),
    );
  });
});
