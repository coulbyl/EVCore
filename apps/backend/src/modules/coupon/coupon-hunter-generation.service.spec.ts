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

function makeHarness(avoided: string[] = []) {
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

describe('CouponHunterGenerationService', () => {
  it('writes the three hunters of the day, shown like any coupon', async () => {
    const { service, repository } = makeHarness();
    const outcomes = await service.generateForDate(new Date('2026-10-29'));

    expect(outcomes.map((o) => [o.hunter, o.outcome])).toEqual([
      ['HUNTER_BTTS', 'composed'],
      ['HUNTER_DRAW', 'composed'],
      ['HUNTER_SCORE', 'composed'],
    ]);
    const calls = vi.mocked(repository.upsertPriceComposerProposal).mock.calls;
    expect(calls.map(([input]) => input.profile?.source)).toEqual([
      CouponSource.PRICE_COMPOSER,
      CouponSource.PRICE_COMPOSER,
      CouponSource.ENGINE,
    ]);
    expect(calls.map(([input]) => input.profile?.targetOddsMin)).toEqual([
      1.45, 2.9, 6,
    ]);
    // Le score exact annonce la probabilité du marché (marge de grille 27 %).
    expect(calls[2]?.[0].legs[0]?.probability).toBeCloseTo(1 / 6.5 / 1.27, 3);
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledTimes(3);
  });

  it('never hunts on a match the AVOID meta-channel flags', async () => {
    // f2 porte le seul nul de la bande : signalé, le chasseur Nul s'abstient.
    const { service } = makeHarness(['f2']);
    const outcomes = await service.generateForDate(new Date('2026-10-29'));
    expect(outcomes.find((o) => o.hunter === 'HUNTER_DRAW')?.outcome).toBe(
      'abstained',
    );
  });
});
