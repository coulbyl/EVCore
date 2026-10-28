import { describe, it, expect, vi } from 'vitest';
import { CouponSource } from '@evcore/db';
import { CouponHunterGenerationService } from './coupon-hunter-generation.service';
import { CouponPricedPoolService } from './coupon-priced-pool.service';
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

const PRICES = new Map<string, number>([
  ['f1|BTTS|YES', 1.6],
  ['f1|BTTS|NO', 2.2],
  ['f2|ONE_X_TWO|HOME', 2.1],
  ['f2|ONE_X_TWO|DRAW', 3.3],
  ['f2|ONE_X_TWO|AWAY', 3.6],
  ['f3|CORRECT_SCORE|1:0', 6.5],
]);

function makeHarness(avoided: string[] = [], reliable: string[] = ['c1']) {
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
        fixtureId: 'f3',
        competition: 'PL',
        channel: 'CORRECT_SCORE',
        market: 'CORRECT_SCORE',
        pick: '1:0',
        odds: 6.5,
        probability: 0.13,
        scheduledAt: KICKOFF,
      },
    ]),
    findAvoidedFixtureIds: vi.fn().mockResolvedValue(avoided),
    // f4 en championnat fiable (c1), f5 dans un championnat sans stats (c2).
    findCornersQuotes: vi
      .fn()
      .mockResolvedValue(
        [
          corners('f4', 'c1', ['OVER', 1.95], ['UNDER', 1.88]),
          corners('f5', 'c2', ['OVER', 1.92], ['UNDER', 1.92]),
        ].flat(),
      ),
    findReliableCornerCompetitions: vi.fn().mockResolvedValue(reliable),
    upsertPriceComposerProposal: vi.fn().mockResolvedValue('proposal-1'),
    recordPriceComposerAttempt: vi.fn().mockResolvedValue(undefined),
  } as unknown as CouponRepository;
  const playable = {
    // 1xBet cote chaque choix demandé au prix de la ligne (PRICES).
    findPlayableQuotes: vi.fn(
      (keys: { fixtureId: string; market: string; pick: string }[]) =>
        Promise.resolve(
          new Map(
            keys.map((k) => {
              const key = `${k.fixtureId}|${k.market}|${k.pick}`;
              const odds = PRICES.get(key) ?? 0;
              return [
                key,
                {
                  ...k,
                  operatorOdds: odds,
                  operatorBookmaker: '1xBet',
                  operatorMargin: null,
                  lowestOdds: odds,
                  lowestBookmaker: '1xBet',
                },
              ];
            }),
          ),
        ),
    ),
  } as unknown as PlayableOddsRepository;
  return {
    service: new CouponHunterGenerationService(
      repository,
      playable,
      new CouponPricedPoolService(repository, playable),
    ),
    repository,
  };
}

const SNAPSHOT = new Date('2026-10-29T10:00:00Z');

function corners(
  fixtureId: string,
  competitionId: string,
  ...sides: ['OVER' | 'UNDER', number][]
) {
  return sides.map(([pick, odds]) => ({
    fixtureId,
    competitionId,
    scheduledAt: KICKOFF,
    line: 9.5,
    pick,
    bookmaker: '1xBet',
    odds,
    snapshotAt: SNAPSHOT,
  }));
}

describe('CouponHunterGenerationService', () => {
  it('writes the three hunters of the day, shown like any coupon', async () => {
    const { service, repository } = makeHarness();
    const outcomes = await service.generateForDate(new Date('2026-10-29'));

    expect(outcomes.map((o) => [o.hunter, o.outcome])).toEqual([
      ['HUNTER_BTTS', 'composed'],
      ['HUNTER_DRAW', 'composed'],
      ['HUNTER_SCORE', 'composed'],
      ['HUNTER_CORNERS', 'composed'],
    ]);
    const calls = vi.mocked(repository.upsertPriceComposerProposal).mock.calls;
    expect(calls.map(([input]) => input.profile?.source)).toEqual([
      CouponSource.PRICE_COMPOSER,
      CouponSource.PRICE_COMPOSER,
      CouponSource.ENGINE,
      CouponSource.PRICE_COMPOSER,
    ]);
    expect(calls.map(([input]) => input.profile?.targetOddsMin)).toEqual([
      1.45, 2.9, 6, 1.7,
    ]);
    // Corners : le côté le moins cher du championnat fiable, avec sa ligne et
    // son prix 1xBet ; f5 (championnat sans stats) n'est jamais joué.
    expect(calls[3]?.[0].legs[0]).toMatchObject({
      fixtureId: 'f4',
      market: 'CORNERS',
      pick: 'UNDER',
      line: 9.5,
      operatorOdds: 1.88,
    });
    // Le score exact annonce la probabilité du marché (marge de grille 27 %).
    expect(calls[2]?.[0].legs[0]?.probability).toBeCloseTo(1 / 6.5 / 1.27, 3);
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledTimes(4);
  });

  it('never hunts on a match the AVOID meta-channel flags', async () => {
    // f2 porte le seul nul de la bande : signalé, le chasseur Nul s'abstient.
    const { service } = makeHarness(['f2']);
    const outcomes = await service.generateForDate(new Date('2026-10-29'));
    expect(outcomes.find((o) => o.hunter === 'HUNTER_DRAW')?.outcome).toBe(
      'abstained',
    );
  });

  it('abstains on corners when no championship has reliable stats', async () => {
    const { service, repository } = makeHarness([], []);
    const outcomes = await service.generateForDate(new Date('2026-10-29'));
    expect(outcomes.find((o) => o.hunter === 'HUNTER_CORNERS')?.outcome).toBe(
      'abstained',
    );
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'no_reliable_competition',
        pass: expect.objectContaining({ name: 'hunter-hunter_corners' }),
      }),
    );
  });
});
