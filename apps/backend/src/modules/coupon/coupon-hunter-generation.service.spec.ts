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
  ['f6|FIRST_HALF_WINNER|HOME', 3.1],
  ['f6|FIRST_HALF_WINNER|DRAW', 2.4],
  ['f6|FIRST_HALF_WINNER|AWAY', 3.5],
]);

function makeHarness(
  avoided: string[] = [],
  reliable: string[] = ['c1'],
  aiPlays: {
    fixtureId: string;
    competition: string;
    market: string;
    pick: string;
  }[] = [],
) {
  const repository = {
    findAiPlays: vi
      .fn()
      .mockResolvedValue(aiPlays.map((p) => ({ ...p, scheduledAt: KICKOFF }))),
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
    // 1X2 de la mi-temps complet sur f6, nul à 2,40 dans la bande.
    findHalfTimeResultCandidates: vi
      .fn()
      .mockResolvedValue([
        priced('f6', 'FIRST_HALF_WINNER/HOME', 3.1),
        priced('f6', 'FIRST_HALF_WINNER/DRAW', 2.4),
        priced('f6', 'FIRST_HALF_WINNER/AWAY', 3.5),
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
    upsertPriceComposerProposal: vi
      .fn()
      .mockResolvedValue({ proposalId: 'proposal-1', created: true }),
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
                  // The AI plays (a…) carry their market frequency.
                  operatorFairProbability: k.fixtureId.startsWith('a')
                    ? 0.95 / odds
                    : null,
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
  it('writes the hunters of the day, shown like any coupon', async () => {
    const { service, repository } = makeHarness();
    const outcomes = await service.generateForDate(new Date('2026-10-29'));

    expect(outcomes.map((o) => [o.hunter, o.outcome])).toEqual([
      ['HUNTER_BTTS', 'composed'],
      ['HUNTER_DRAW', 'composed'],
      ['HUNTER_HT_DRAW', 'composed'],
      ['HUNTER_SCORE', 'composed'],
      ['HUNTER_CORNERS', 'composed'],
      // No AI play on the day: no AI combo.
      ['AI_COMBO', 'abstained'],
    ]);
    const calls = vi.mocked(repository.upsertPriceComposerProposal).mock.calls;
    expect(calls.map(([input]) => input.profile?.source)).toEqual([
      CouponSource.PRICE_COMPOSER,
      CouponSource.PRICE_COMPOSER,
      CouponSource.PRICE_COMPOSER,
      CouponSource.ENGINE,
      CouponSource.PRICE_COMPOSER,
    ]);
    expect(calls.map(([input]) => input.profile?.targetOddsMin)).toEqual([
      1.45, 2.9, 2.1, 6, 1.7,
    ]);
    // Nul à la mi-temps : la fréquence du marché sans marge, jamais 1 / cote.
    const htDraw = calls[2]?.[0].legs[0];
    expect(htDraw).toMatchObject({
      fixtureId: 'f6',
      market: 'FIRST_HALF_WINNER',
      pick: 'DRAW',
      odds: 2.4,
    });
    expect(htDraw?.probability).toBeLessThan(1 / 2.4);
    // Corners : le côté le moins cher du championnat fiable, avec sa ligne et
    // son prix 1xBet ; f5 (championnat sans stats) n'est jamais joué.
    expect(calls[4]?.[0].legs[0]).toMatchObject({
      fixtureId: 'f4',
      market: 'CORNERS',
      pick: 'UNDER',
      line: 9.5,
      operatorOdds: 1.88,
    });
    // Le score exact annonce la probabilité du marché (marge de grille 27 %).
    expect(calls[3]?.[0].legs[0]?.probability).toBeCloseTo(1 / 6.5 / 1.27, 3);
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledTimes(6);
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'composed',
        pass: expect.objectContaining({ name: 'hunter-hunter_ht_draw' }),
      }),
    );
  });

  it('never hunts on a match the AVOID meta-channel flags', async () => {
    // f2 porte le seul nul de la bande : signalé, le chasseur Nul s'abstient.
    const { service } = makeHarness(['f2']);
    const outcomes = await service.generateForDate(new Date('2026-10-29'));
    expect(outcomes.find((o) => o.hunter === 'HUNTER_DRAW')?.outcome).toBe(
      'abstained',
    );
  });

  it('never hunts the half-time draw on a match AVOID flags', async () => {
    const { service, repository } = makeHarness(['f6']);
    const outcomes = await service.generateForDate(new Date('2026-10-29'));
    expect(outcomes.find((o) => o.hunter === 'HUNTER_HT_DRAW')?.outcome).toBe(
      'abstained',
    );
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'no_candidate_in_band',
        pass: expect.objectContaining({ name: 'hunter-hunter_ht_draw' }),
      }),
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

  it('says when 1xBet prices no corners at all', async () => {
    const { service, repository } = makeHarness();
    vi.mocked(repository.findCornersQuotes).mockResolvedValue(
      corners('f4', 'c1', ['OVER', 1.95], ['UNDER', 1.88]).map((q) => ({
        ...q,
        bookmaker: 'Pinnacle',
      })),
    );
    await service.generateForDate(new Date('2026-10-29'));
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'no_operator_price' }),
    );
  });

  it("writes the AI combo from the AI's own plays, cheapest first, one per league", async () => {
    PRICES.set('a1|BTTS|YES', 1.7);
    PRICES.set('a2|OVER_UNDER|OVER_2_5', 1.6);
    PRICES.set('a3|ONE_X_TWO|HOME', 1.65);
    const { service, repository } = makeHarness(
      [],
      ['c1'],
      [
        { fixtureId: 'a1', competition: 'PL', market: 'BTTS', pick: 'YES' },
        {
          fixtureId: 'a2',
          competition: 'SA',
          market: 'OVER_UNDER',
          pick: 'OVER_2_5',
        },
        {
          fixtureId: 'a3',
          competition: 'LL',
          market: 'ONE_X_TWO',
          pick: 'HOME',
        },
      ],
    );
    const outcomes = await service.generateForDate(new Date('2026-10-29'));
    expect(outcomes.at(-1)).toMatchObject({
      hunter: 'AI_COMBO',
      outcome: 'composed',
    });
    const calls = vi.mocked(repository.upsertPriceComposerProposal).mock.calls;
    const combo = calls.at(-1)?.[0];
    expect(combo?.profile).toMatchObject({
      source: CouponSource.PRICE_COMPOSER,
      targetOddsMin: 4,
      targetOddsMax: 10,
    });
    // 1.7 × 1.6 × 1.65 = 4.488, three leagues.
    expect(combo?.combinedOdds).toBe(4.488);
    expect(combo?.legs.map((l) => l.fixtureId).sort()).toEqual([
      'a1',
      'a2',
      'a3',
    ]);
  });
});
