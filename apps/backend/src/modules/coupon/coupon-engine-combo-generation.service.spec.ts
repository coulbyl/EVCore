import { Prisma } from '@evcore/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PlayableOddsRepository,
  PlayableQuote,
} from '../betting-engine/pricing/playable-odds.repository';
import type {
  MatchesRepository,
  ReadingCandidateRow,
} from '../screens/matches.repository';
import { CouponEngineComboGenerationService } from './coupon-engine-combo-generation.service';
import type {
  CouponRepository,
  ReadingComboFixtureRow,
} from './coupon.repository';

const FOR_DATE = new Date('2026-11-06T00:00:00.000Z');

const fixture = (
  fixtureId: string,
  competition: string,
): ReadingComboFixtureRow => ({
  fixtureId,
  competition,
  scheduledAt: new Date(`2026-11-06T${fixtureId === 'b' ? 20 : 18}:00:00Z`),
});

const candidate = (
  over: Partial<ReadingCandidateRow> = {},
): ReadingCandidateRow => ({
  fixtureId: 'a',
  avoided: false,
  channel: 'DOMINANT',
  market: 'ONE_X_TWO',
  pick: 'HOME',
  probability: new Prisma.Decimal(0.7),
  result: 'PENDING',
  ...over,
});

const quote = (input: {
  fixtureId: string;
  market?: string;
  pick?: string;
  odds: number;
  fair: number | null;
}): [string, PlayableQuote] => {
  const market = input.market ?? 'ONE_X_TWO';
  const pick = input.pick ?? 'HOME';
  return [
    `${input.fixtureId}|${market}|${pick}`,
    {
      fixtureId: input.fixtureId,
      market,
      pick,
      operatorOdds: input.odds,
      operatorBookmaker: '1xBet',
      operatorMargin: 0.05,
      operatorFairProbability: input.fair,
      lowestOdds: input.odds,
      lowestBookmaker: '1xBet',
    },
  ];
};

function makeRepository() {
  return {
    findReadingComboFixtures:
      vi.fn<CouponRepository['findReadingComboFixtures']>(),
    upsertPriceComposerProposal:
      vi.fn<CouponRepository['upsertPriceComposerProposal']>(),
    recordPriceComposerAttempt:
      vi.fn<CouponRepository['recordPriceComposerAttempt']>(),
  };
}

describe('CouponEngineComboGenerationService', () => {
  let repository: ReturnType<typeof makeRepository>;
  let findReadingCandidates: ReturnType<
    typeof vi.fn<MatchesRepository['findReadingCandidates']>
  >;
  let quotes: Map<string, PlayableQuote>;
  let service: CouponEngineComboGenerationService;

  beforeEach(() => {
    repository = makeRepository();
    repository.upsertPriceComposerProposal.mockResolvedValue({
      proposalId: 'proposal-1',
      created: true,
    });
    repository.recordPriceComposerAttempt.mockResolvedValue();
    findReadingCandidates = vi.fn<MatchesRepository['findReadingCandidates']>();
    quotes = new Map();
    service = new CouponEngineComboGenerationService(
      repository as unknown as CouponRepository,
      {
        findPlayableQuotes: vi.fn(() => Promise.resolve(quotes)),
      } as unknown as PlayableOddsRepository,
      { findReadingCandidates } as unknown as MatchesRepository,
    );
  });

  it("writes an ENGINE proposal from the matches' readings, priced and announced at 1xBet", async () => {
    repository.findReadingComboFixtures.mockResolvedValue([
      fixture('a', 'L1'),
      fixture('b', 'PL'),
    ]);
    findReadingCandidates.mockResolvedValue([
      candidate({ fixtureId: 'a' }),
      candidate({
        fixtureId: 'b',
        channel: 'DOUBLE_CHANCE',
        market: 'DOUBLE_CHANCE',
        pick: 'HOME_DRAW',
      }),
    ]);
    quotes = new Map([
      quote({ fixtureId: 'a', odds: 1.4, fair: 0.68 }),
      quote({
        fixtureId: 'b',
        market: 'DOUBLE_CHANCE',
        pick: 'HOME_DRAW',
        odds: 1.45,
        fair: 0.66,
      }),
    ]);

    const result = await service.generateForDate(FOR_DATE);

    expect(result).toMatchObject({ outcome: 'composed', candidateCount: 2 });
    const input = repository.upsertPriceComposerProposal.mock.calls[0]?.[0];
    expect(input?.legs.map((l) => [l.fixtureId, l.market, l.pick])).toEqual([
      ['a', 'ONE_X_TWO', 'HOME'],
      ['b', 'DOUBLE_CHANCE', 'HOME_DRAW'],
    ]);
    expect(input?.legs[0]).toMatchObject({
      odds: 1.4,
      probability: 0.68,
      canal: 'DOMINANT',
      operatorOdds: 1.4,
    });
    expect(input?.legs[1]?.canal).toBe('DOUBLE_CHANCE');
    expect(input?.combinedOdds).toBeCloseTo(1.4 * 1.45, 6);
    expect(input?.lastFixtureScheduledAt).toEqual(
      new Date('2026-11-06T20:00:00Z'),
    );
    expect(input?.profile).toMatchObject({
      source: 'ENGINE',
      targetOddsMin: 1.2,
      policyVersion: 'engine-combo-v3',
    });
    expect(findReadingCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ fixtureIds: ['a', 'b'] }),
    );
  });

  it('ignores a match without a reading and never swaps in another pick', async () => {
    repository.findReadingComboFixtures.mockResolvedValue([
      fixture('a', 'L1'),
      fixture('b', 'PL'),
      fixture('c', 'SA'),
    ]);
    findReadingCandidates.mockResolvedValue([
      candidate({ fixtureId: 'a' }),
      // AVOID fired: no reading on this match.
      candidate({ fixtureId: 'b', avoided: true }),
      candidate({ fixtureId: 'c' }),
    ]);
    quotes = new Map([
      quote({ fixtureId: 'a', odds: 1.4, fair: 0.68 }),
      quote({ fixtureId: 'b', odds: 1.5, fair: 0.64 }),
      quote({ fixtureId: 'c', odds: 1.6, fair: 0.6 }),
    ]);

    await service.generateForDate(FOR_DATE);

    const input = repository.upsertPriceComposerProposal.mock.calls[0]?.[0];
    expect(input?.legs.map((l) => l.fixtureId)).toEqual(['a', 'c']);
  });

  it('abstains when a reading is under 1.30 at 1xBet or not priced there', async () => {
    repository.findReadingComboFixtures.mockResolvedValue([
      fixture('a', 'L1'),
      fixture('b', 'PL'),
      fixture('c', 'SA'),
    ]);
    findReadingCandidates.mockResolvedValue([
      candidate({ fixtureId: 'a' }),
      candidate({ fixtureId: 'b' }),
      candidate({ fixtureId: 'c' }),
    ]);
    quotes = new Map([
      quote({ fixtureId: 'a', odds: 1.4, fair: 0.68 }),
      // A reading at 1.25: shown on the match, too short for the combo.
      quote({ fixtureId: 'b', odds: 1.25, fair: 0.77 }),
      // c has no 1xBet price: no reading, never a leg.
    ]);

    const result = await service.generateForDate(FOR_DATE);

    expect(result).toMatchObject({
      outcome: 'abstained',
      reason: 'not_enough_readings',
      candidateCount: 1,
    });
    expect(repository.upsertPriceComposerProposal).not.toHaveBeenCalled();
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'abstained',
        pass: { name: 'engine-combo', policyVersion: 'engine-combo-v3' },
      }),
    );
  });
});
