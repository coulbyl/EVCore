import { describe, it, expect, vi } from 'vitest';
import { CouponSource } from '@evcore/db';
import { CouponHunterGenerationService } from './coupon-hunter-generation.service';
import type { CouponRepository } from './coupon.repository';
import type { PlayableOddsRepository } from '../betting-engine/pricing/playable-odds.repository';

const KICKOFF = new Date('2026-10-29T19:00:00Z');

function priced(
  fixtureId: string,
  selection: `${string}/${string}`,
  odds: number,
) {
  const [market, pick] = selection.split('/');
  return {
    fixtureId,
    competition: 'PL',
    market,
    pick,
    odds,
    band: 'x',
    scheduledAt: KICKOFF,
  };
}

function makeHarness() {
  const repository = {
    // BTTS coté complet sur f1 (dans la bande) ; 1X2 complet sur f2.
    findDoubleCandidates: vi
      .fn()
      .mockResolvedValue([
        priced('f1', 'BTTS/YES', 1.6),
        priced('f1', 'BTTS/NO', 2.2),
        priced('f2', 'ONE_X_TWO/HOME', 2.1),
        priced('f2', 'ONE_X_TWO/DRAW', 3.3),
        priced('f2', 'ONE_X_TWO/AWAY', 3.6),
      ]),
    findEngineComboCandidates: vi.fn().mockResolvedValue([
      {
        fixtureId: 'f2',
        competition: 'PL',
        channel: 'DRAW',
        market: 'ONE_X_TWO',
        pick: 'DRAW',
        odds: 3.3,
        probability: 0.3,
        scheduledAt: KICKOFF,
      },
    ]),
    findChannelCompetitionCalibration: vi.fn().mockResolvedValue([]),
    upsertPriceComposerProposal: vi.fn().mockResolvedValue('proposal-1'),
    recordPriceComposerAttempt: vi.fn().mockResolvedValue(undefined),
  } as unknown as CouponRepository;
  const playable = {
    findPlayableQuotes: vi.fn().mockResolvedValue(new Map()),
  } as unknown as PlayableOddsRepository;
  return {
    service: new CouponHunterGenerationService(repository, playable),
    repository,
  };
}

describe('CouponHunterGenerationService', () => {
  it('writes every hunter pick in shadow, one source per ranking', async () => {
    const { service, repository } = makeHarness();
    const outcomes = await service.generateForDate(new Date('2026-10-29'));

    expect(outcomes).toEqual([
      expect.objectContaining({
        hunter: 'HUNTER_BTTS',
        ranking: 'market',
        outcome: 'composed',
      }),
      expect.objectContaining({
        hunter: 'HUNTER_BTTS',
        ranking: 'engine',
        outcome: 'abstained',
      }),
      expect.objectContaining({
        hunter: 'HUNTER_DRAW',
        ranking: 'market',
        outcome: 'composed',
      }),
      expect.objectContaining({
        hunter: 'HUNTER_DRAW',
        ranking: 'engine',
        outcome: 'composed',
      }),
    ]);
    const calls = vi.mocked(repository.upsertPriceComposerProposal).mock.calls;
    expect(calls).toHaveLength(3);
    for (const [input] of calls) {
      expect(input.profile?.shadow).toBe(true);
    }
    expect(calls.map(([input]) => input.profile?.source)).toEqual([
      CouponSource.PRICE_COMPOSER,
      CouponSource.PRICE_COMPOSER,
      CouponSource.ENGINE,
    ]);
    // Le chasseur Nul classé par le moteur annonce la probabilité du canal.
    expect(calls[2]?.[0].legs[0]).toEqual(
      expect.objectContaining({ pick: 'DRAW', probability: 0.3 }),
    );
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledTimes(4);
  });
});
